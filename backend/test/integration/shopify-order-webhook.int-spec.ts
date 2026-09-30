import request from 'supertest';

import type { ShopifyOrderPayload } from '../../src/orders/dto/shopify-order.dto';
import {
  type TestApp,
  createTestApp,
  resetState,
  seedCatalog,
  seedGeneration,
  seedUser,
  signShopify,
  sleep,
  waitFor,
} from './harness';
import { SHOPIFY_TEST_SECRET } from './test-env';

// El tramo que ningún unit test ve: express.raw montado antes del prefijo
// global, el guard HMAC sobre el Buffer, la cola BullMQ y la ingesta contra
// Postgres real. Si alguien reordena configureApp(), el guard recibe un body
// ya parseado y todo webhook responde 401 — en producción, en silencio.
describe('Webhook Shopify orders/* (integración)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  let orderSeq = 0;

  function buildOrder(opts: {
    email: string;
    generationId: string;
    shopifyProductId: string;
    shopifyVariantId: string;
    financialStatus?: string;
  }): ShopifyOrderPayload {
    orderSeq += 1;
    const now = new Date().toISOString();
    return {
      id: 5_000_000 + orderSeq,
      name: `#T${orderSeq}`,
      email: opts.email,
      currency: 'USD',
      financial_status: opts.financialStatus ?? 'paid',
      fulfillment_status: null,
      subtotal_price: '39.90',
      total_tax: '0.00',
      total_price: '39.90',
      created_at: now,
      updated_at: now,
      line_items: [
        {
          id: 7_000_000 + orderSeq,
          product_id: Number(opts.shopifyProductId),
          variant_id: Number(opts.shopifyVariantId),
          title: 'Puzzle',
          variant_title: 'Perro',
          quantity: 1,
          price: '39.90',
          total_discount: '0.00',
          properties: [
            { name: '_generation_id', value: opts.generationId },
            { name: '_image_url', value: 'https://example.test/art.png' },
          ],
        },
      ],
    };
  }

  function postWebhook(
    topic: 'create' | 'paid',
    payload: unknown,
    { webhookId, secret = SHOPIFY_TEST_SECRET } = {} as {
      webhookId?: string;
      secret?: string;
    },
  ) {
    // Se envía el string, no el Buffer: con Content-Type JSON superagent
    // serializaría el Buffer como {"type":"Buffer","data":[…]} y la firma
    // dejaría de corresponder a los bytes enviados.
    const body = JSON.stringify(payload);
    return request(t.app.getHttpServer())
      .post(`/api/webhooks/shopify/order/${topic}`)
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', signShopify(Buffer.from(body), secret))
      .set('X-Shopify-Webhook-Id', webhookId ?? `wh-${topic}-${Date.now()}`)
      .send(body);
  }

  async function seedBuyer() {
    const catalog = await seedCatalog(t.prisma);
    const user = await seedUser(t.prisma, { credits: 0 });
    const generation = await seedGeneration(
      t.prisma,
      user.id,
      catalog.style.id,
    );
    const payload = buildOrder({
      email: user.email,
      generationId: generation.id,
      shopifyProductId: catalog.product.shopifyProductId,
      shopifyVariantId: catalog.variant.shopifyVariantId,
    });
    return { catalog, user, generation, payload };
  }

  const orderItems = (shopifyOrderId: number) =>
    t.prisma.orderItem.findMany({
      where: { order: { shopifyOrderId: String(shopifyOrderId) } },
    });

  const orderBonuses = (userId: string) =>
    t.prisma.creditTransaction.findMany({
      where: { userId, reason: 'order_bonus' },
    });

  // Espera a que el worker termine la última ingesta: el OrderEvent se escribe
  // al final de ingestShopifyOrder.
  const webhookEvents = (count: number) =>
    waitFor(async () =>
      (await t.prisma.orderEvent.count({
        where: { eventType: 'webhook_received' },
      })) >= count
        ? true
        : null,
    );

  it('orders/create firmado → orden con la línea vinculada al arte del usuario y +3 créditos', async () => {
    const { catalog, user, generation, payload } = await seedBuyer();

    const res = await postWebhook('create', payload).expect(201);
    expect(res.body).toMatchObject({ data: { received: true } });

    await webhookEvents(1);

    const order = await t.prisma.order.findUniqueOrThrow({
      where: { shopifyOrderId: String(payload.id) },
      include: { items: true },
    });
    expect(order.userId).toBe(user.id);
    expect(order.financialStatus).toBe('paid');
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      generationId: generation.id,
      productRefId: catalog.product.id,
      productFormatVariantId: catalog.variant.id,
      // Pagada y con el arte ya completado: entra directo a la cola del admin.
      productionStatus: 'draft',
    });

    const buyer = await t.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(buyer.generationCredits).toBe(3);
    expect(await orderBonuses(user.id)).toHaveLength(1);
  });

  it('firma con otro secreto → 401 y no se crea nada', async () => {
    const { payload } = await seedBuyer();

    await postWebhook('create', payload, { secret: 'otro-secreto' }).expect(
      401,
    );

    // Margen para que un job encolado por error llegara a procesarse.
    await sleep(500);
    expect(await t.prisma.order.count()).toBe(0);
  });

  it('_generation_id de otro usuario → la línea se crea sin vincular', async () => {
    const { catalog, payload } = await seedBuyer();
    const stranger = await seedUser(t.prisma);
    const foreignArt = await seedGeneration(
      t.prisma,
      stranger.id,
      catalog.style.id,
    );
    payload.line_items[0].properties[0].value = foreignArt.id;

    await postWebhook('create', payload).expect(201);
    await webhookEvents(1);

    const [item] = await orderItems(payload.id);
    expect(item.generationId).toBeNull();
  });

  describe('idempotencia', () => {
    it('el mismo webhook dos veces → una orden, una línea, un bono', async () => {
      const { user, payload } = await seedBuyer();

      await postWebhook('create', payload, { webhookId: 'wh-dup' }).expect(201);
      await webhookEvents(1);
      // Con removeOnComplete el jobId ya no deduplica tras procesarse: el
      // reintento de Shopify se vuelve a ingerir y la idempotencia recae en el
      // upsert de la orden y en el unique del ledger.
      await postWebhook('create', payload, { webhookId: 'wh-dup' }).expect(201);
      await webhookEvents(2);

      expect(await t.prisma.order.count()).toBe(1);
      expect(await orderItems(payload.id)).toHaveLength(1);
      expect(await orderBonuses(user.id)).toHaveLength(1);
      const buyer = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(buyer.generationCredits).toBe(3);
    });

    it('create pendiente y luego paid → una orden y el bono una sola vez', async () => {
      const { user, payload } = await seedBuyer();

      await postWebhook('create', {
        ...payload,
        financial_status: 'pending',
      }).expect(201);
      await webhookEvents(1);
      expect(await orderBonuses(user.id)).toHaveLength(0);

      await postWebhook('paid', payload).expect(201);
      await webhookEvents(2);
      // Un orders/updated tras el pago no debe otorgar otra vez.
      await postWebhook('paid', payload).expect(201);
      await webhookEvents(3);

      expect(await t.prisma.order.count()).toBe(1);
      const [item] = await orderItems(payload.id);
      expect(item.productionStatus).toBe('draft');
      expect(await orderBonuses(user.id)).toHaveLength(1);
      const buyer = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(buyer.generationCredits).toBe(3);
    });
  });
});
