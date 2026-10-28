import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
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
    productFormatVariant: { findMany: jest.fn() },
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
    prisma.productFormatVariant.findMany.mockResolvedValue([]);
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
      item({ generationId: null, generation: null }),
    );

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.sourceUrl).toBeNull();
    expect(result.printImageUrl).toBeNull();
  });

  it('rejects saving when no original IA art exists', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ generationId: null, generation: null }),
    );

    await expect(
      service.applyEnhance('order-1', 'item-1', { format: 'jpeg' }),
    ).rejects.toThrow(BadRequestException);
  });

  // Sin tamaño de impresión la sangre no se puede medir. Antes se omitía en
  // silencio y el máster salía sin bleed aunque el admin lo pidiera.
  it('rejects bleed when the variant has no print size', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ variantTitle: 'Perro', productVariant: { printConfig: null } }),
    );

    await expect(
      service.applyEnhance('order-1', 'item-1', {
        format: 'jpeg',
        bleed: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // El tamaño elegido en el Print Studio para la línea manda sobre el de la
  // variante, sin tocar el catálogo.
  it('prefers the item print size over the variant', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(
      item({ printConfig: { widthCm: 20, heightCm: 30 } }),
    );

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.printInches?.width).toBeCloseTo(20 / 2.54, 2);
    expect(result.printConfigSource).toBe('item');
  });

  it('offers distinct catalogue sizes as presets', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(item());
    prisma.productFormatVariant.findMany.mockResolvedValue([
      { printConfig: { widthCm: 20, heightCm: 30, bleedMm: 3, minDpi: 300 } },
      { printConfig: { widthCm: 20, heightCm: 30, bleedMm: 3 } },
      { printConfig: { widthCm: 20, heightCm: 30 } },
      { printConfig: { minDpi: 300 } },
    ]);

    const result = await service.getEnhanceInfo('order-1', 'item-1');

    expect(result.printSizePresets).toEqual([{ widthCm: 20, heightCm: 30 }]);
  });

  it('rejects an item print size without width and height', async () => {
    await expect(
      service.setItemPrintConfig('order-1', 'item-1', { widthCm: 20 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
  });

  // La sangre es fija de 3 mm, aunque la variante guarde otro bleedMm.
  it('extends the master by a fixed 3 mm bleed per side', async () => {
    const source = await sharp({
      create: { width: 100, height: 150, channels: 3, background: '#ff0000' },
    })
      .jpeg()
      .toBuffer();
    const buildPrintImage = (
      service as unknown as {
        buildPrintImage: (
          b: Buffer,
          i: { width: number; height: number },
          o: object,
        ) => Promise<Buffer>;
      }
    ).buildPrintImage.bind(service);

    const out = await buildPrintImage(
      source,
      { width: 20 / 2.54, height: 30 / 2.54 },
      { bleed: true, bleedColor: '#000000', format: 'jpeg' },
    );

    // 3 mm a 300 DPI = 35 px por lado.
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(100 + 2 * 35);
    expect(meta.height).toBe(150 + 2 * 35);
  });

  // extend y mirror rellenan la banda con la propia imagen, no con bleedColor.
  it.each(['extend', 'mirror'] as const)(
    'fills the bleed with image pixels in %s mode',
    async (bleedMode) => {
      const source = await sharp({
        create: { width: 100, height: 150, channels: 3, background: '#ff0000' },
      })
        .png()
        .toBuffer();
      const buildPrintImage = (
        service as unknown as {
          buildPrintImage: (
            b: Buffer,
            i: { width: number; height: number },
            o: object,
          ) => Promise<Buffer>;
        }
      ).buildPrintImage.bind(service);

      const out = await buildPrintImage(
        source,
        { width: 20 / 2.54, height: 30 / 2.54 },
        { bleed: true, bleedMode, bleedColor: '#000000', format: 'png' },
      );

      const { data, info } = await sharp(out)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(100 + 2 * 35);
      // Esquina superior izquierda: dentro de la banda de bleed.
      expect([data[0], data[1], data[2]]).toEqual([255, 0, 0]);
    },
  );

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
  // El máster se limita a 300 DPI cubriendo el área de impresión: una fuente
  // 3:4 a 20×30 cm (2:3) no puede quedar por debajo en el eje que se recorta.
  describe('buildPrintImage DPI cap', () => {
    const printInches = { width: 20 / 2.54, height: 30 / 2.54 };
    const source = () =>
      sharp({
        create: {
          width: 3584,
          height: 4800,
          channels: 3,
          background: '#808080',
        },
      })
        .jpeg()
        .toBuffer();
    const build = (buffer: Buffer, options: Record<string, unknown>) =>
      (
        service as unknown as {
          buildPrintImage: (
            b: Buffer,
            p: typeof printInches,
            o: Record<string, unknown>,
          ) => Promise<Buffer>;
        }
      ).buildPrintImage(buffer, printInches, options);

    it('keeps 300 DPI on both axes when the ratio differs', async () => {
      const out = await sharp(await build(await source(), {})).metadata();
      expect(out.width).toBe(2645);
      expect(out.height).toBe(3543);
    });

    it('crops to the exact format with fitToFormat', async () => {
      const out = await sharp(
        await build(await source(), { fitToFormat: true }),
      ).metadata();
      expect(out.width).toBe(2362);
      expect(out.height).toBe(3543);
    });

    // Fuente con la mitad izquierda roja y la derecha azul: el encuadre decide
    // qué color queda en el máster.
    const halves = () =>
      sharp({
        create: {
          width: 3000,
          height: 3000,
          channels: 3,
          background: '#0000ff',
        },
      })
        .composite([
          {
            input: {
              create: {
                width: 1500,
                height: 3000,
                channels: 3,
                background: '#ff0000',
              },
            },
            left: 0,
            top: 0,
          },
        ])
        .png()
        .toBuffer();
    const dominant = async (buffer: Buffer) => {
      const { channels } = await sharp(buffer).stats();
      return channels[0].mean > channels[2].mean ? 'red' : 'blue';
    };

    it('keeps the framed side of the image', async () => {
      const left = await build(await halves(), {
        fitToFormat: true,
        crop: { x: 0, y: 0.5, zoom: 1 },
      });
      const right = await build(await halves(), {
        fitToFormat: true,
        crop: { x: 1, y: 0.5, zoom: 1 },
      });
      expect(await dominant(left)).toBe('red');
      expect(await dominant(right)).toBe('blue');
    });

    it('zooming in lowers the resolution of the master', async () => {
      const out = await sharp(
        await build(await halves(), {
          fitToFormat: true,
          crop: { x: 0.5, y: 0.5, zoom: 2 },
        }),
      ).metadata();
      // Rect 1000×1500 px de la fuente: por debajo de 2362×3543, no se agranda.
      expect(out.width).toBe(1000);
      expect(out.height).toBe(1500);
    });
  });
});
