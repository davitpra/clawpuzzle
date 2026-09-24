import { Test, TestingModule } from '@nestjs/testing';
import { ProductSyncService } from './product-sync.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  productReference: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  format: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  productFormatVariant: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

describe('ProductSyncService', () => {
  let service: ProductSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductSyncService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductSyncService>(ProductSyncService);
    jest.clearAllMocks();
  });

  describe('upsertProduct', () => {
    it('creates a new product and maps shopifyHandle', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue(null);
      mockPrisma.productReference.create.mockResolvedValue({ id: 'ref-1' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.upsertProduct({
        id: 123,
        handle: 'my-poster',
        title: 'My Poster',
        body_html: '<p>desc</p>',
        status: 'active',
        variants: [],
      });

      expect(result).toEqual({ action: 'created', id: 'ref-1' });
      expect(mockPrisma.productReference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopifyHandle: 'my-poster',
            name: 'my-poster',
            displayName: 'My Poster',
            description: 'desc',
            isActive: true,
          }) as unknown,
        }),
      );
    });

    it('updates an existing product', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        id: 'ref-1',
        isActive: true,
      });
      mockPrisma.productReference.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.upsertProduct({
        id: 123,
        handle: 'my-poster',
        title: 'My Poster Updated',
        body_html: '',
        status: 'active',
        variants: [],
      });

      expect(result).toEqual({ action: 'updated', id: 'ref-1' });
    });

    // ClawAndSoul escribía aquí dos columnas más desde el metafield
    // del metafield de Shopify, con un spread condicional que impedía a TypeScript
    // validarlas contra el modelo Prisma: al quitarlas del schema el typecheck
    // siguió pasando y el fallo solo habría salido en runtime. Este test fija
    // que el upsert escribe exactamente los campos que el modelo tiene.
    it('writes only the columns the model still has', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        id: 'ref-1',
        isActive: true,
      });
      mockPrisma.productReference.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.upsertProduct({
        id: 123,
        handle: 'custom-pet-puzzle',
        title: 'Custom Pet Puzzle',
        body_html: '',
        status: 'active',
        variants: [],
      });

      const calls = mockPrisma.productReference.update.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >;
      expect(Object.keys(calls[0][0].data).sort()).toEqual([
        'description',
        'displayName',
        'isActive',
        'name',
        'shopifyHandle',
      ]);
    });
  });

  describe('syncVariants', () => {
    const variant = (id: number, title: string) => ({
      id,
      title,
      option1: title,
      option2: null,
      option3: null,
    });

    beforeEach(() => {
      mockPrisma.productFormatVariant.upsert.mockResolvedValue({});
      mockPrisma.productFormatVariant.updateMany.mockResolvedValue({});
    });

    it('gives every variant the product format, whatever its option', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        formatId: 'fmt-4-3',
      });

      const result = await service.syncVariants(
        'ref-1',
        [variant(1, '300 pieces'), variant(2, '1000 pieces')],
        'custom-pet-puzzle',
      );

      expect(result).toEqual({ synced: 2, skipped: 0 });
      expect(mockPrisma.format.findFirst).not.toHaveBeenCalled();
      for (const id of ['1', '2']) {
        expect(mockPrisma.productFormatVariant.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              productRefId_shopifyVariantId: {
                productRefId: 'ref-1',
                shopifyVariantId: id,
              },
            },
            create: expect.objectContaining({
              formatId: 'fmt-4-3',
              isActive: true,
            }) as unknown,
          }),
        );
      }
    });

    it('does not overwrite the format of an existing variant', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        formatId: 'fmt-4-3',
      });

      await service.syncVariants('ref-1', [variant(1, 'Default Title')], 'p');

      const calls = mockPrisma.productFormatVariant.upsert.mock.calls as Array<
        [{ update: Record<string, unknown> }]
      >;
      expect(calls[0][0].update).not.toHaveProperty('formatId');
    });

    it('assigns the oldest active format to a product without one', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        formatId: null,
      });
      mockPrisma.format.findFirst.mockResolvedValue({ id: 'fmt-4-3' });
      mockPrisma.productReference.update.mockResolvedValue({});

      const result = await service.syncVariants(
        'ref-1',
        [variant(1, 'Default Title')],
        'p',
      );

      expect(result).toEqual({ synced: 1, skipped: 0 });
      expect(mockPrisma.format.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(mockPrisma.productReference.update).toHaveBeenCalledWith({
        where: { id: 'ref-1' },
        data: { formatId: 'fmt-4-3' },
      });
    });

    it('skips variants when there is no active format at all', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        formatId: null,
      });
      mockPrisma.format.findFirst.mockResolvedValue(null);

      const result = await service.syncVariants(
        'ref-1',
        [variant(1, '300 pieces'), variant(2, '500 pieces')],
        'p',
      );

      expect(result).toEqual({ synced: 0, skipped: 2 });
      expect(mockPrisma.productFormatVariant.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.productReference.update).not.toHaveBeenCalled();
    });

    it('deactivates variants no longer present in Shopify, even without a format', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        formatId: null,
      });
      mockPrisma.format.findFirst.mockResolvedValue(null);

      await service.syncVariants('ref-1', [variant(100, '8x10')], 'p');

      expect(mockPrisma.productFormatVariant.updateMany).toHaveBeenCalledWith({
        where: {
          productRefId: 'ref-1',
          shopifyVariantId: { notIn: ['100'] },
          isActive: true,
        },
        data: { isActive: false },
      });
    });

    it('handles product with no variants without failing', async () => {
      mockPrisma.productReference.findUnique.mockResolvedValue({
        formatId: 'fmt-4-3',
      });

      const result = await service.syncVariants('ref-1', [], 'p');

      expect(result).toEqual({ synced: 0, skipped: 0 });
      expect(mockPrisma.productFormatVariant.upsert).not.toHaveBeenCalled();
    });
  });
});
