// uuid v13 es ESM-only y jest no transforma node_modules; lo mockeamos para
// evitar el parse (OrdersService lo importa aunque este spec no lo ejercite).
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ShopifyApiService } from '../shopify-sync/shopify-api.service';
import { CreditsService } from '../credits/credits.service';
import { GuestAccountService } from '../users/guest-account.service';
import type { ShopifyOrderPayload } from './dto/shopify-order.dto';

const mockPrisma = {
  creditTransaction: {
    findUnique: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  creditPackVariant: {
    findMany: jest.fn(),
  },
  orderEvent: {
    create: jest.fn(),
  },
  generation: {
    findFirst: jest.fn(),
  },
  productReference: {
    findUnique: jest.fn(),
  },
  productFormatVariant: {
    findFirst: jest.fn(),
  },
  expense: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  // La implementación (pasar el propio mock como cliente `tx`) se asigna en
  // beforeEach: referenciar mockPrisma aquí sería un ciclo en su propio inicializador.
  $transaction: jest.fn(),
};

const mockGuestAccounts = {
  mergeGuestInto: jest.fn(),
};

const mockCredits = {
  grant: jest.fn().mockResolvedValue(true),
  revoke: jest.fn().mockResolvedValue(true),
};

const mockShopifyApi = {
  getFulfillmentDisplayStatus: jest.fn().mockResolvedValue(null),
};

// findUnique del ledger enruta por reason (order_bonus / pack_purchase).
function stubGrants(opts: {
  bonusUserId?: string | null;
  packUserId?: string | null;
}) {
  mockPrisma.creditTransaction.findUnique.mockImplementation(
    (args: { where: { reason_referenceId: { reason: string } } }) => {
      const reason = args.where.reason_referenceId.reason;
      if (reason === 'order_bonus') {
        return Promise.resolve(
          opts.bonusUserId ? { userId: opts.bonusUserId } : null,
        );
      }
      if (reason === 'pack_purchase') {
        return Promise.resolve(
          opts.packUserId ? { userId: opts.packUserId } : null,
        );
      }
      return Promise.resolve(null);
    },
  );
}

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: {} },
        { provide: ShopifyApiService, useValue: mockShopifyApi },
        { provide: CreditsService, useValue: mockCredits },
        { provide: GuestAccountService, useValue: mockGuestAccounts },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    mockPrisma.order.findUnique.mockResolvedValue({ orderNumber: '#1042' });
    mockPrisma.orderItem.findUnique.mockResolvedValue(null);
    mockPrisma.orderItem.create.mockResolvedValue({});
    mockPrisma.orderItem.findMany.mockResolvedValue([]);
    mockPrisma.generation.findFirst.mockResolvedValue(null);
    mockPrisma.productReference.findUnique.mockResolvedValue(null);
    mockPrisma.productFormatVariant.findFirst.mockResolvedValue(null);
    mockPrisma.creditPackVariant.findMany.mockResolvedValue([]);
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockShopifyApi.getFulfillmentDisplayStatus.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockPrisma),
    );
  });

  function buildOrderPayload(
    overrides: Partial<ShopifyOrderPayload>,
  ): ShopifyOrderPayload {
    return {
      id: 9001,
      name: '#2001',
      currency: 'CAD',
      subtotal_price: '25.00',
      total_tax: '0.00',
      total_price: '25.00',
      created_at: '2026-09-18T00:00:00.000Z',
      updated_at: '2026-09-18T00:00:00.000Z',
      line_items: [],
      ...overrides,
    };
  }

  // Acceso al método privado sin exponerlo en la API pública.
  const reverse = (orderId: string, itemIds: string[]) =>
    (
      service as unknown as {
        reverseCreditsForItems: (o: string, i: string[]) => Promise<void>;
      }
    ).reverseCreditsForItems(orderId, itemIds);

  const ingestLine = (
    orderUserId: string | null,
    financialStatus: string,
    properties = [{ name: 'generation_id', value: 'generation-1' }],
  ) =>
    (
      service as unknown as {
        ingestLineItem: (
          orderId: string,
          userId: string | null,
          lineItem: {
            id: number;
            title: string;
            quantity: number;
            price: string;
            total_discount: string;
            properties: { name: string; value: string }[];
          },
          status: string,
        ) => Promise<void>;
      }
    ).ingestLineItem(
      'order-1',
      orderUserId,
      {
        id: 101,
        title: 'Custom art',
        quantity: 1,
        price: '25.00',
        total_discount: '0.00',
        properties,
      },
      financialStatus,
    );

  describe('line art linkage', () => {
    // La validación de propiedad es el control de seguridad de la ingesta: una
    // línea puede declarar cualquier generation_id, así que solo se enlaza si
    // pertenece al usuario resuelto para la orden.
    it('does not link a generation owned by another user', async () => {
      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'item-1',
        productionStatus: 'pending',
      });

      await ingestLine('order-user', 'paid');

      expect(mockPrisma.generation.findFirst).toHaveBeenCalledWith({
        where: { id: 'generation-1', userId: 'order-user' },
        select: { id: true, status: true },
      });
      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: expect.objectContaining({
          generation: { disconnect: true },
        }),
      });
    });

    it('links owned art and puts a paid line in the production queue', async () => {
      mockPrisma.generation.findFirst.mockResolvedValue({
        id: 'generation-1',
        status: 'completed',
      });

      await ingestLine('order-user', 'paid');

      expect(mockPrisma.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          generationId: 'generation-1',
          productionStatus: 'draft',
        }),
      });
    });

    it('reads the hidden _generation_id and _image_url attributes', async () => {
      mockPrisma.generation.findFirst.mockResolvedValue({
        id: 'generation-1',
        status: 'completed',
      });

      await ingestLine('order-user', 'paid', [
        { name: '_generation_id', value: 'generation-1' },
        { name: '_image_url', value: 'https://example.com/art.png' },
      ]);

      expect(mockPrisma.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          generationId: 'generation-1',
          imageUrl: 'https://example.com/art.png',
        }),
      });
    });

    it('keeps an authorized line pending until a later paid webhook', async () => {
      mockPrisma.generation.findFirst.mockResolvedValue({
        id: 'generation-1',
        status: 'completed',
      });

      await ingestLine('order-user', 'authorized');

      expect(mockPrisma.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          generationId: 'generation-1',
          productionStatus: 'pending',
        }),
      });

      mockPrisma.orderItem.findUnique.mockResolvedValue({
        id: 'item-1',
        productionStatus: 'pending',
      });
      await ingestLine('order-user', 'paid');

      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: expect.objectContaining({ productionStatus: 'draft' }),
      });
    });
  });

  describe('ingestShopifyOrder userId resolution', () => {
    it('prefers the order email match over a generation_id owned by a different account', async () => {
      mockPrisma.order.upsert.mockResolvedValue({
        id: 'order-1',
        userId: 'account-a',
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'account-a' });
      // El generation_id de la línea pertenece a otra cuenta: el lookup
      // combinado a nivel de orden (where.id es un objeto `{ in: [...] }`) lo
      // devuelve, pero el chequeo de propiedad por línea (where.userId
      // presente) debe fallar porque no coincide con el email resuelto.
      mockPrisma.generation.findFirst.mockImplementation(
        (args: { where: { userId?: string } }) =>
          Promise.resolve(args.where.userId ? null : { userId: 'account-b' }),
      );

      const payload = buildOrderPayload({
        email: 'buyer@example.com',
        line_items: [
          {
            id: 501,
            title: 'Custom art',
            quantity: 1,
            price: '25.00',
            total_discount: '0.00',
            properties: [
              { name: 'generation_id', value: 'generation-other-user' },
            ],
          },
        ],
      });

      await service.ingestShopifyOrder(payload);

      expect(mockPrisma.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ userId: 'account-a' }),
        }),
      );
      // La orden quedó resuelta a account-a (por email); el chequeo de
      // propiedad por línea usa ese userId y no encuentra la generación
      // ajena, así que no se vincula (protección IDOR intacta).
      expect(mockPrisma.generation.findFirst).toHaveBeenCalledWith({
        where: { id: 'generation-other-user', userId: 'account-a' },
        select: { id: true, status: true },
      });
    });

    it('still links generation_id-derived ownership when it matches the email-resolved user', async () => {
      mockPrisma.order.upsert.mockResolvedValue({
        id: 'order-1',
        userId: 'account-a',
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'account-a' });
      mockPrisma.generation.findFirst.mockImplementation(
        (args: { where: { userId?: string } }) =>
          Promise.resolve(
            args.where.userId
              ? { id: 'generation-own', status: 'completed' }
              : { userId: 'account-a' },
          ),
      );

      const payload = buildOrderPayload({
        email: 'buyer@example.com',
        line_items: [
          {
            id: 502,
            title: 'Custom art',
            quantity: 1,
            price: '25.00',
            total_discount: '0.00',
            properties: [{ name: 'generation_id', value: 'generation-own' }],
          },
        ],
      });

      await service.ingestShopifyOrder(payload);

      expect(mockPrisma.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ generationId: 'generation-own' }),
      });
    });
  });

  describe('reverseCreditsForItems', () => {
    it('no hace nada si la orden nunca recibió grants', async () => {
      stubGrants({ bonusUserId: null, packUserId: null });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { id: 'item-1', shopifyVariantId: 'v1', quantity: 1 },
      ]);

      await reverse('order-1', ['item-1']);

      expect(mockCredits.revoke).not.toHaveBeenCalled();
    });

    it('no-op si itemIds está vacío (no consulta grants)', async () => {
      await reverse('order-1', []);
      expect(mockPrisma.creditTransaction.findUnique).not.toHaveBeenCalled();
      expect(mockCredits.revoke).not.toHaveBeenCalled();
    });

    it('separa líneas regulares (3/unidad) de packs (creditAmount*qty)', async () => {
      stubGrants({ bonusUserId: 'user-bonus', packUserId: 'user-pack' });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { id: 'reg-1', shopifyVariantId: 'v-reg', quantity: 3 },
        { id: 'pack-1', shopifyVariantId: 'v-pack', quantity: 2 },
      ]);
      mockPrisma.creditPackVariant.findMany.mockResolvedValue([
        { shopifyVariantId: 'v-pack', creditAmount: 100 },
      ]);

      await reverse('order-1', ['reg-1', 'pack-1']);

      expect(mockCredits.revoke).toHaveBeenCalledTimes(2);
      // Regular: 3 * 3 = 9, userId del grant order_bonus.
      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-bonus',
        9,
        'order_bonus_reversal',
        'reg-1',
        expect.any(String),
      );
      // Pack: 100 * 2 = 200, userId del grant pack_purchase.
      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-pack',
        200,
        'pack_purchase_reversal',
        'pack-1',
        expect.any(String),
      );
    });

    // LIMITACIÓN CONOCIDA (refund parcial por cantidad): reverseCreditsForItems
    // decide el monto con la cantidad TOTAL del OrderItem (it.quantity), no con la
    // cantidad realmente reembolsada. El webhook además descarta
    // refunds[].refund_line_items[].quantity (orders.service.ts:228-230), pasando
    // solo el line_item_id. Por eso el primer refund parcial de una línea de pack
    // revierte la LÍNEA COMPLETA, y —por la idempotencia (reason, OrderItem.id)—
    // un segundo refund de esa misma línea es no-op. Este test fija ese
    // comportamiento actual (sobre-reversión a nivel de línea), no la exactitud por
    // unidad. Si algún día se corrige, este test debe actualizarse.
    it('refund parcial de un pack revierte la línea COMPLETA (creditAmount*qty total)', async () => {
      stubGrants({ bonusUserId: null, packUserId: 'user-pack' });
      // OrderItem con 3 unidades; el cliente solo reembolsó 1 (info que no llega
      // hasta aquí). La reversión usa las 3 unidades igualmente.
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { id: 'pack-1', shopifyVariantId: 'v-pack', quantity: 3 },
      ]);
      mockPrisma.creditPackVariant.findMany.mockResolvedValue([
        { shopifyVariantId: 'v-pack', creditAmount: 100 },
      ]);

      await reverse('order-1', ['pack-1']);

      // 100 * 3 = 300 (línea completa), no 100 * 1 = 100 (unidad reembolsada).
      expect(mockCredits.revoke).toHaveBeenCalledTimes(1);
      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-pack',
        300,
        'pack_purchase_reversal',
        'pack-1',
        expect.any(String),
      );
    });

    it('revierte el bono de cada línea de puzzle', async () => {
      stubGrants({ bonusUserId: 'user-bonus', packUserId: null });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          id: 'puzzle-1',
          shopifyVariantId: 'v-500',
          quantity: 1,
          productRef: { template: 'Puzzle' },
        },
        {
          id: 'puzzle-2',
          shopifyVariantId: 'v-1000',
          quantity: 2,
          productRef: { template: 'Puzzle' },
        },
      ]);

      await reverse('order-1', ['puzzle-1', 'puzzle-2']);

      expect(mockCredits.revoke).toHaveBeenCalledTimes(2);
      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-bonus',
        3,
        'order_bonus_reversal',
        'puzzle-1',
        expect.any(String),
      );
      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-bonus',
        6,
        'order_bonus_reversal',
        'puzzle-2',
        expect.any(String),
      );
    });

    it('omite líneas de pack cuando no existe grant pack_purchase', async () => {
      stubGrants({ bonusUserId: 'user-bonus', packUserId: null });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { id: 'reg-1', shopifyVariantId: 'v-reg', quantity: 1 },
        { id: 'pack-1', shopifyVariantId: 'v-pack', quantity: 2 },
      ]);
      mockPrisma.creditPackVariant.findMany.mockResolvedValue([
        { shopifyVariantId: 'v-pack', creditAmount: 100 },
      ]);

      await reverse('order-1', ['reg-1', 'pack-1']);

      expect(mockCredits.revoke).toHaveBeenCalledTimes(1);
      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-bonus',
        3,
        'order_bonus_reversal',
        'reg-1',
        expect.any(String),
      );
    });
  });

  // Acceso al método privado sin exponerlo en la API pública.
  const grant = (order: {
    id: string;
    userId: string;
    orderNumber: string | null;
  }) =>
    (
      service as unknown as {
        grantOrderCredits: (o: typeof order) => Promise<void>;
      }
    ).grantOrderCredits(order);

  describe('grantOrderCredits', () => {
    it('otorga +3 por unidad de puzzle', async () => {
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          shopifyVariantId: 'v-500',
          quantity: 2,
          productRef: { template: 'Puzzle' },
        },
        {
          shopifyVariantId: 'v-1000',
          quantity: 1,
          productRef: { template: 'Puzzle' },
        },
      ]);

      await grant({ id: 'order-1', userId: 'user-1', orderNumber: '#1042' });

      // 3 unidades de puzzle × 3 créditos.
      expect(mockCredits.grant).toHaveBeenCalledTimes(1);
      expect(mockCredits.grant).toHaveBeenCalledWith(
        'user-1',
        9,
        'order_bonus',
        'order-1',
        expect.any(String),
      );
    });

    // Un pack de créditos ya acredita por `pack_purchase`; sumarle además el
    // bono por unidad sería pagar dos veces la misma compra.
    it('no otorga order_bonus por una línea de pack de créditos', async () => {
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          shopifyVariantId: 'v-pack',
          quantity: 1,
          productRef: { template: 'Credits' },
        },
      ]);
      mockPrisma.creditPackVariant.findMany.mockResolvedValue([
        { shopifyVariantId: 'v-pack', creditAmount: 100 },
      ]);

      await grant({ id: 'order-1', userId: 'user-1', orderNumber: '#1042' });

      expect(mockCredits.grant).not.toHaveBeenCalledWith(
        'user-1',
        expect.any(Number),
        'order_bonus',
        'order-1',
        expect.any(String),
      );
    });
  });

  describe('transitionItemStatus clawback hook', () => {
    it('revierte créditos al pasar un item a un estado de clawback', async () => {
      mockPrisma.orderItem.findFirst.mockResolvedValue({
        id: 'item-1',
        productionStatus: 'draft',
        notes: null,
        shippedAt: null,
        deliveredAt: null,
      });
      mockPrisma.orderItem.update.mockResolvedValue({});
      mockPrisma.orderEvent.create.mockResolvedValue({});
      stubGrants({ bonusUserId: 'user-bonus', packUserId: null });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { id: 'item-1', shopifyVariantId: 'v-reg', quantity: 1 },
      ]);

      await service.transitionItemStatus('order-1', 'item-1', 'refunded');

      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-bonus',
        3,
        'order_bonus_reversal',
        'item-1',
        expect.any(String),
      );
    });

    it('no revierte en transiciones que no son de clawback', async () => {
      mockPrisma.orderItem.findFirst.mockResolvedValue({
        id: 'item-1',
        productionStatus: 'draft',
        notes: null,
        shippedAt: null,
        deliveredAt: null,
      });
      mockPrisma.orderItem.update.mockResolvedValue({});
      mockPrisma.orderEvent.create.mockResolvedValue({});

      await service.transitionItemStatus('order-1', 'item-1', 'pre_production');

      expect(mockCredits.revoke).not.toHaveBeenCalled();
    });
  });

  describe('deleteShopifyOrder', () => {
    // findUnique se comparte con reverseCreditsForItems (que lo llama para el
    // orderNumber): la primera respuesta es la orden, el resto el número.
    function stubOrder(order: unknown) {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(order)
        .mockResolvedValue({ orderNumber: '#1042' });
    }

    it('es no-op si la orden no existe localmente', async () => {
      stubOrder(null);

      await service.deleteShopifyOrder('999');

      expect(mockPrisma.order.delete).not.toHaveBeenCalled();
      expect(mockCredits.revoke).not.toHaveBeenCalled();
    });

    it('revierte créditos antes de borrar y desvincula las expenses', async () => {
      stubOrder({
        id: 'order-1',
        orderNumber: '#1042',
        userId: 'user-1',
        items: [{ id: 'item-1' }],
      });
      stubGrants({ bonusUserId: 'user-1', packUserId: null });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { id: 'item-1', shopifyVariantId: 'v-reg', quantity: 2 },
      ]);
      mockPrisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', detail: { provider: 'fal' } },
      ]);

      await service.deleteShopifyOrder('999');

      expect(mockCredits.revoke).toHaveBeenCalledWith(
        'user-1',
        6, // 2 unidades * 3 créditos
        'order_bonus_reversal',
        'item-1',
        expect.any(String),
      );
      // La FK de Expense es Cascade: sin desvincular, el gasto real se perdería.
      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: {
          orderId: null,
          detail: {
            provider: 'fal',
            deletedOrder: {
              id: 'order-1',
              orderNumber: '#1042',
              shopifyOrderId: '999',
            },
          },
        },
      });
      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('borra igual una orden sin créditos ni expenses', async () => {
      stubOrder({
        id: 'order-2',
        orderNumber: '#1043',
        userId: null,
        items: [],
      });
      stubGrants({ bonusUserId: null, packUserId: null });

      await service.deleteShopifyOrder('1000');

      expect(mockCredits.revoke).not.toHaveBeenCalled();
      expect(mockPrisma.expense.update).not.toHaveBeenCalled();
      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-2' },
      });
    });
  });
});
