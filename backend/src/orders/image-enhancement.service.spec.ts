import { BadRequestException } from '@nestjs/common';
import { ImageEnhancementService } from './image-enhancement.service';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('ImageEnhancementService generation source', () => {
  const generationUrl = 'https://cdn.example.com/generation.png';
  const pbnSourceUrl = 'https://cdn.example.com/original-ai-art.png';
  const pbnPreviewUrl = 'https://cdn.example.com/pbn-preview.png';

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
      imageUrl: pbnPreviewUrl,
      fulfillmentMethod: 'pod',
      variantTitle: '12x16″',
      generationId: 'generation-1',
      generation: {
        resultUrl: generationUrl,
        resultStorageKey: 'generation.png',
      },
      paintByNumbers: {
        sourceImageUrl: pbnSourceUrl,
        sourceImageStorageKey: 'original-ai-art.png',
      },
      productVariant: { podConfig: { width: 12, height: 16 } },
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

  it('prefers the linked generation and ignores the PBN preview', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(item());

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.sourceUrl).toBe(generationUrl);
    expect(result.sourceUrl).not.toBe(pbnPreviewUrl);
  });

  it('uses the original IA art saved as the PBN source when generation is unlinked', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ generationId: null, generation: null }),
    );

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.sourceUrl).toBe(pbnSourceUrl);
    expect(result.sourceUrl).not.toBe(pbnPreviewUrl);
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
        printSourceUrl: pbnPreviewUrl,
        printUpscaledUrl: 'https://cdn.example.com/pbn-base.jpg',
        printUpscaledStorageKey: 'pbn-base.jpg',
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
      'https://cdn.example.com/pbn-base.jpg',
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
