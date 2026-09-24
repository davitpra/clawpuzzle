import { BadRequestException } from '@nestjs/common';
import { ImageEnhancementService } from './image-enhancement.service';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('ImageEnhancementService generation source', () => {
  const generationUrl = 'https://cdn.example.com/generation.png';
  const productImageUrl = 'https://cdn.example.com/product.png';

  const prisma = {
    orderItem: {
      findFirst: jest.fn(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
    order: { findUnique: jest.fn() },
    orderEvent: { create: jest.fn() },
  };
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  let service: ImageEnhancementService;

  function item(overrides: Record<string, unknown> = {}) {
    return {
      id: 'item-1',
      orderId: 'order-1',
      imageUrl: productImageUrl,
      variantTitle: '500 pieces · 48x36 cm',
      generationId: 'generation-1',
      generation: {
        resultUrl: generationUrl,
        resultStorageKey: 'generation.png',
      },
      productVariant: {
        printConfig: { widthCm: 48, heightCm: 36, bleedMm: 5 },
      },
      printImageUrl: null,
      printImageStorageKey: null,
      printSourceUrl: null,
      printSourceStorageKey: null,
      printUpscaledUrl: null,
      printUpscaledStorageKey: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImageEnhancementService(
      prisma as never,
      storage as never,
      {} as never,
      { get: jest.fn().mockReturnValue(true) } as never,
      {} as never,
    );
    jest
      .spyOn(service as never, 'probeDimensions' as never)
      .mockResolvedValue({ width: 1200, height: 1600 } as never);
    jest
      .spyOn(service as never, 'detectBorderColor' as never)
      .mockResolvedValue('#ffffff' as never);
  });

  it('prefers the linked generation over the product image', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(item());

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.sourceUrl).toBe(generationUrl);
    expect(result.sourceUrl).not.toBe(productImageUrl);
  });

  // El tamaño físico gobierna el DPI y, con él, la recomendación de upscale y
  // el bleed. ClawAndSoul lo sacaba del título de la variante, que solo casaba
  // con el símbolo ″: un título métrico daba null en silencio. Estos dos tests
  // fijan el orden printConfig → título. El Format no entra: solo es la
  // proporción de la imagen, no el tamaño físico.
  it('takes the print size from printConfig, in centimetres', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(item());

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.printInches?.width).toBeCloseTo(48 / 2.54, 2);
    expect(result.printInches?.height).toBeCloseTo(36 / 2.54, 2);
  });

  it('parses a metric variant title as a last resort', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ productVariant: { printConfig: null } }),
    );

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.printInches?.width).toBeCloseTo(48 / 2.54, 2);
  });

  it('returns no source when no original IA art exists', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ generationId: null, generation: null, paintByNumbers: null }),
    );

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.sourceUrl).toBeNull();
    expect(result.printImageUrl).toBeNull();
  });

  it('rejects saving when no original IA art exists', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ generationId: null, generation: null, paintByNumbers: null }),
    );

    await expect(
      service.applyEnhance('order-1', 'item-1', { format: 'jpeg' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('drops a stale base and saves the generation as the print source', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({
        printSourceUrl: productImageUrl,
        printUpscaledUrl: 'https://cdn.example.com/stale-base.jpg',
        printUpscaledStorageKey: 'stale-base.jpg',
      }),
    );
    prisma.orderItem.update.mockResolvedValue({});
    storage.upload.mockResolvedValue(
      'https://cdn.example.com/generation-print.jpg',
    );
    storage.delete.mockResolvedValue(undefined);
    const download = jest
      .spyOn(service as never, 'download' as never)
      .mockResolvedValue(Buffer.from('source') as never);
    jest
      .spyOn(service as never, 'buildPrintImage' as never)
      .mockResolvedValue(Buffer.from('print') as never);
    jest
      .spyOn(service as never, 'recordEvent' as never)
      .mockResolvedValue(undefined as never);

    await service.applyEnhance('order-1', 'item-1', { format: 'jpeg' });

    expect(download).toHaveBeenCalledWith(generationUrl);
    expect(download).not.toHaveBeenCalledWith(
      'https://cdn.example.com/stale-base.jpg',
    );
    const updateCall: unknown = prisma.orderItem.update.mock.calls[0]?.[0];
    expect(updateCall).toMatchObject({
      where: { id: 'item-1' },
      data: {
        printSourceUrl: generationUrl,
        printSourceStorageKey: null,
        printUpscaledUrl: null,
        printUpscaledStorageKey: null,
      },
    });
  });
});
