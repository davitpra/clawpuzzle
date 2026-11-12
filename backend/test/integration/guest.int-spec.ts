import { ConfigService } from '@nestjs/config';
import request from 'supertest';

import type { ShopifyOrderPayload } from '../../src/orders/dto/shopify-order.dto';
import { CreditsService } from '../../src/credits/credits.service';
import { GuestAccountService } from '../../src/users/guest-account.service';
import {
  type TestApp,
  cookieValue,
  cookiesFrom,
  createTestApp,
  resetState,
  seedCatalog,
  seedGeneration,
  seedPetWithPhoto,
  seedUser,
  signShopify,
  waitFor,
} from './harness';
import { SHOPIFY_TEST_SECRET } from './test-env';

// La imagen gratis sin login: sesión de invitado, su único crédito, y lo que
// pasa con su arte al registrarse o al comprar con el email de otra cuenta.
describe('Sesión de invitado (integración)', () => {
  let t: TestApp;
  let config: ConfigService;
  let guests: GuestAccountService;

  beforeAll(async () => {
    t = await createTestApp();
    config = t.app.get(ConfigService);
    guests = t.app.get(GuestAccountService);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetState(t);
    config.set('guest.enabled', true);
    config.set('guest.dailyCap', 1000);
  });

  const http = () => request(t.app.getHttpServer());

  // El rate limit va por IP (5/hora) y su contador vive en memoria durante toda
  // la suite: cada test usa su propia IP para no heredar el de los demás.
  let ipSeq = 0;
  const nextIp = () => `203.0.113.${++ipSeq}`;

  function startGuest(ip = nextIp(), cookies: string[] = []) {
    return http()
      .post('/api/auth/guest')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookies)
      .send({});
  }

  type UserBody = { data: { user: { id: string; role: string } } };

  it('crea un invitado con 1 crédito y una sesión de 30 días', async () => {
    const res = await startGuest().expect(200);
    const { user } = (res.body as UserBody).data;
    expect(user.role).toBe('guest');

    const row = await t.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(row.generationCredits).toBe(1);

    const refreshCookie = (
      res.headers['set-cookie'] as unknown as string[]
    ).find((c) => c.startsWith('refreshToken='))!;
    expect(refreshCookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it('genera una imagen gratis y la segunda responde 402 invitando a registrarse', async () => {
    const res = await startGuest().expect(200);
    const cookies = cookiesFrom(res);
    const { user } = (res.body as UserBody).data;

    const catalog = await seedCatalog(t.prisma);
    const { pet, photo } = await seedPetWithPhoto(t.prisma, user.id);
    const body = {
      petId: pet.id,
      petPhotoId: photo.id,
      formatId: catalog.format.id,
      productRefId: catalog.product.id,
      styleId: catalog.style.id,
    };

    const first = await http()
      .post('/api/generations')
      .set('Cookie', cookies)
      .send(body)
      .expect(201);
    const generationId = (first.body as { data: { id: string } }).data.id;

    const second = await http()
      .post('/api/generations')
      .set('Cookie', cookies)
      .send(body)
      .expect(402);
    expect(JSON.stringify(second.body)).toContain('Regístrate');

    // Que el worker termine antes de que el siguiente test vacíe la base.
    await waitFor(async () => {
      const g = await t.prisma.generation.findUniqueOrThrow({
        where: { id: generationId },
      });
      return g.status === 'completed' || g.status === 'failed';
    });
  });

  it('con la sesión de un invitado activo devuelve el mismo invitado', async () => {
    const ip = nextIp();
    const first = await startGuest(ip).expect(200);
    const refresh = cookieValue(cookiesFrom(first), 'refreshToken');

    const again = await startGuest(ip, [`refreshToken=${refresh}`]).expect(200);
    expect((again.body as UserBody).data.user.id).toBe(
      (first.body as UserBody).data.user.id,
    );
    expect(await t.prisma.user.count({ where: { role: 'guest' } })).toBe(1);
  });

  it('con el interruptor apagado responde 503 y no crea nada', async () => {
    config.set('guest.enabled', false);
    await startGuest().expect(503);
    expect(await t.prisma.user.count()).toBe(0);
  });

  it('con el tope diario alcanzado responde 429', async () => {
    config.set('guest.dailyCap', 1);
    await startGuest().expect(200);
    await startGuest().expect(429);
    expect(await t.prisma.user.count({ where: { role: 'guest' } })).toBe(1);
  });

  it('limita a 5 sesiones por hora y por IP', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) await startGuest(ip).expect(200);
    await startGuest(ip).expect(429);
  });

  it('al registrarse conserva el id y el arte, y suma 4 créditos', async () => {
    const guest = await guests.createGuest();
    const catalog = await seedCatalog(t.prisma);
    const generation = await seedGeneration(
      t.prisma,
      guest.id,
      catalog.style.id,
    );

    const user = await guests.upgradeGuest(
      guest.id,
      { email: 'nueva@test.local', googleId: 'google-1' },
      4,
    );

    expect(user.id).toBe(guest.id);
    expect(user.role).toBe('user');
    expect(user.email).toBe('nueva@test.local');
    expect(user.generationCredits).toBe(5);
    const art = await t.prisma.generation.findUniqueOrThrow({
      where: { id: generation.id },
    });
    expect(art.userId).toBe(guest.id);
  });

  it('al entrar con una cuenta existente pasa el arte y los créditos comprados, no el gratis', async () => {
    const guest = await guests.createGuest();
    const target = await seedUser(t.prisma, { credits: 2 });
    const catalog = await seedCatalog(t.prisma);
    const generation = await seedGeneration(
      t.prisma,
      guest.id,
      catalog.style.id,
    );
    await t.app
      .get(CreditsService)
      .grant(guest.id, 3, 'order_bonus', 'order-1', 'test');

    await guests.mergeGuestInto(guest.id, target.id);

    expect(
      await t.prisma.user.findUnique({ where: { id: guest.id } }),
    ).toBeNull();
    const art = await t.prisma.generation.findUniqueOrThrow({
      where: { id: generation.id },
    });
    expect(art.userId).toBe(target.id);

    const after = await t.prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(after.generationCredits).toBe(2 + 3);
    const ledger = await t.prisma.creditTransaction.aggregate({
      where: { userId: target.id },
      _sum: { amount: true },
    });
    // La cuenta destino ya traía 2 créditos sin movimientos en el ledger.
    expect(ledger._sum.amount).toBe(3);
  });

  it('un pedido de invitado con el email de una cuenta existente se fusiona con ella', async () => {
    const guest = await guests.createGuest();
    const account = await seedUser(t.prisma, { email: 'cliente@test.local' });
    const catalog = await seedCatalog(t.prisma);
    const generation = await seedGeneration(
      t.prisma,
      guest.id,
      catalog.style.id,
    );

    const now = new Date().toISOString();
    const payload: ShopifyOrderPayload = {
      id: 6_100_001,
      name: '#G1',
      email: account.email,
      currency: 'USD',
      financial_status: 'paid',
      fulfillment_status: null,
      subtotal_price: '39.90',
      total_tax: '0.00',
      total_price: '39.90',
      created_at: now,
      updated_at: now,
      line_items: [
        {
          id: 7_100_001,
          product_id: Number(catalog.product.shopifyProductId),
          variant_id: Number(catalog.variant.shopifyVariantId),
          title: 'Puzzle',
          variant_title: 'Perro',
          quantity: 1,
          price: '39.90',
          total_discount: '0.00',
          properties: [
            { name: '_user_id', value: guest.id },
            { name: '_generation_id', value: generation.id },
            { name: '_image_url', value: 'https://example.test/art.png' },
          ],
        },
      ],
    };
    const body = JSON.stringify(payload);
    await http()
      .post('/api/webhooks/shopify/order/create')
      .set('Content-Type', 'application/json')
      .set(
        'X-Shopify-Hmac-Sha256',
        signShopify(Buffer.from(body), SHOPIFY_TEST_SECRET),
      )
      .set('X-Shopify-Webhook-Id', 'wh-guest-merge')
      .send(body)
      .expect(201);

    const order = await waitFor(() =>
      t.prisma.order.findUnique({
        where: { shopifyOrderId: String(payload.id) },
        include: { items: true },
      }),
    );
    await waitFor(async () =>
      (await t.prisma.orderEvent.count({
        where: { eventType: 'webhook_received' },
      })) >= 1
        ? true
        : null,
    );

    expect(order.userId).toBe(account.id);
    const [item] = await t.prisma.orderItem.findMany({
      where: { orderId: order.id },
    });
    expect(item.generationId).toBe(generation.id);
    expect(
      await t.prisma.user.findUnique({ where: { id: guest.id } }),
    ).toBeNull();
  });
});
