import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { PrintProjectEnhancementService } from './print-project-enhancement.service';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('PrintProjectEnhancementService', () => {
  const generationUrl = 'https://cdn.example.com/generation.png';
  const uploadUrl = 'https://cdn.example.com/upload.png';

  const prisma = {
    printProject: {
      findUnique: jest.fn(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
    orderItem: { update: jest.fn<Promise<unknown>, [unknown]>() },
    productFormatVariant: { findMany: jest.fn() },
    orderEvent: { create: jest.fn() },
  };
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  let service: PrintProjectEnhancementService;

  function orderItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'item-1',
      orderId: 'order-1',
      variantTitle: '500 pieces · 48x36 cm',
      printImageUrl: null,
      printImageStorageKey: null,
      printSourceUrl: null,
      printSourceStorageKey: null,
      productVariant: {
        printConfig: { widthCm: 48, heightCm: 36, bleedMm: 5 },
      },
      order: { userId: 'user-1' },
      ...overrides,
    };
  }

  function project(overrides: Record<string, unknown> = {}) {
    return {
      id: 'project-1',
      title: 'Proyecto',
      orderItemId: 'item-1',
      generationId: 'generation-1',
      generation: {
        resultUrl: generationUrl,
        resultStorageKey: 'generation.png',
      },
      sourceUrl: generationUrl,
      sourceStorageKey: null,
      upscaledUrl: null,
      upscaledStorageKey: null,
      printImageUrl: null,
      printImageStorageKey: null,
      printConfig: null,
      printCrop: null,
      orderItem: orderItem(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.productFormatVariant.findMany.mockResolvedValue([]);
    prisma.printProject.update.mockResolvedValue({});
    prisma.orderItem.update.mockResolvedValue({});
    storage.delete.mockResolvedValue(undefined);
    service = new PrintProjectEnhancementService(
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

  function stubSave(masterUrl = 'https://cdn.example.com/master.jpg') {
    storage.upload.mockResolvedValue(masterUrl);
    const download = jest
      .spyOn(service as never, 'download' as never)
      .mockResolvedValue(Buffer.from('source') as never);
    jest
      .spyOn(service as never, 'buildPrintImage' as never)
      .mockResolvedValue(Buffer.from('print') as never);
    return download;
  }

  it('uses the current image of the generation as source', async () => {
    prisma.printProject.findUnique.mockResolvedValue(project());

    const result = await service.getEnhanceInfo('project-1');

    expect(result.sourceUrl).toBe(generationUrl);
  });

  it('uses the uploaded image when there is no generation', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({
        generationId: null,
        generation: null,
        sourceUrl: uploadUrl,
        sourceStorageKey: 'upload.png',
      }),
    );

    const result = await service.getEnhanceInfo('project-1');

    expect(result.sourceUrl).toBe(uploadUrl);
  });

  // El tamaño físico gobierna el DPI y, con él, la recomendación de upscale y
  // el bleed. ClawAndSoul lo sacaba del título de la variante, que solo casaba
  // con el símbolo ″: un título métrico daba null en silencio. Estos tests
  // fijan el orden proyecto → variante → título. El Format no entra: solo es la
  // proporción de la imagen, no el tamaño físico.
  it('takes the print size from the linked variant, in centimetres', async () => {
    prisma.printProject.findUnique.mockResolvedValue(project());

    const result = await service.getEnhanceInfo('project-1');

    expect(result.printInches?.width).toBeCloseTo(48 / 2.54, 2);
    expect(result.printInches?.height).toBeCloseTo(36 / 2.54, 2);
    expect(result.printConfigSource).toBe('variant');
  });

  it('parses a metric variant title as a last resort', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({
        orderItem: orderItem({ productVariant: { printConfig: null } }),
      }),
    );

    const result = await service.getEnhanceInfo('project-1');

    expect(result.printInches?.width).toBeCloseTo(48 / 2.54, 2);
  });

  it('prefers the project print size over the variant', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({ printConfig: { widthCm: 20, heightCm: 30 } }),
    );

    const result = await service.getEnhanceInfo('project-1');

    expect(result.printInches?.width).toBeCloseTo(20 / 2.54, 2);
    expect(result.printConfigSource).toBe('project');
  });

  it('has no print size when unlinked and unset', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({ orderItemId: null, orderItem: null }),
    );

    const result = await service.getEnhanceInfo('project-1');

    expect(result.printInches).toBeNull();
    expect(result.printConfigSource).toBeNull();
  });

  it('returns no source when the project has no image', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({ generationId: null, generation: null, sourceUrl: null }),
    );

    const result = await service.getEnhanceInfo('project-1');

    expect(result.sourceUrl).toBeNull();
    expect(result.printImageUrl).toBeNull();
  });

  it('rejects saving when the project has no image', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({ generationId: null, generation: null, sourceUrl: null }),
    );

    await expect(
      service.applyEnhance('project-1', { format: 'jpeg' }),
    ).rejects.toThrow(BadRequestException);
  });

  // Sin tamaño de impresión la sangre no se puede medir. Antes se omitía en
  // silencio y el máster salía sin bleed aunque el admin lo pidiera.
  it('rejects bleed when there is no print size', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({ orderItemId: null, orderItem: null }),
    );

    await expect(
      service.applyEnhance('project-1', { format: 'jpeg', bleed: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('offers distinct catalogue sizes as presets', async () => {
    prisma.printProject.findUnique.mockResolvedValue(project());
    prisma.productFormatVariant.findMany.mockResolvedValue([
      { printConfig: { widthCm: 20, heightCm: 30, bleedMm: 3, minDpi: 300 } },
      { printConfig: { widthCm: 20, heightCm: 30, bleedMm: 3 } },
      { printConfig: { widthCm: 20, heightCm: 30 } },
      { printConfig: { minDpi: 300 } },
    ]);

    const result = await service.getEnhanceInfo('project-1');

    expect(result.printSizePresets).toEqual([{ widthCm: 20, heightCm: 30 }]);
  });

  it('rejects a print size without width and height', async () => {
    await expect(
      service.setPrintConfig('project-1', { widthCm: 20 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.printProject.update).not.toHaveBeenCalled();
  });

  it('copies the master to the linked item', async () => {
    prisma.printProject.findUnique.mockResolvedValue(project());
    stubSave('https://cdn.example.com/master.jpg');

    await service.applyEnhance('project-1', { format: 'jpeg' });

    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        printImageUrl: 'https://cdn.example.com/master.jpg',
        printImageStorageKey: null,
      },
    });
    expect(prisma.orderEvent.create).toHaveBeenCalled();
  });

  it('saves an unlinked project without touching any order', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({
        orderItemId: null,
        orderItem: null,
        printConfig: { widthCm: 20, heightCm: 30 },
      }),
    );
    stubSave();

    await service.applyEnhance('project-1', { format: 'jpeg' });

    expect(prisma.printProject.update).toHaveBeenCalled();
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
    expect(prisma.orderEvent.create).not.toHaveBeenCalled();
  });

  it('drops a stale base when the generation image changed', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({
        sourceUrl: 'https://cdn.example.com/old-generation.png',
        upscaledUrl: 'https://cdn.example.com/stale-base.jpg',
        upscaledStorageKey: 'stale-base.jpg',
      }),
    );
    const download = stubSave();

    await service.applyEnhance('project-1', { format: 'jpeg' });

    expect(download).toHaveBeenCalledWith(generationUrl);
    expect(download).not.toHaveBeenCalledWith(
      'https://cdn.example.com/stale-base.jpg',
    );
    expect(storage.delete).toHaveBeenCalledWith('stale-base.jpg');
    const updateCall: unknown = prisma.printProject.update.mock.calls[0]?.[0];
    expect(updateCall).toMatchObject({
      where: { id: 'project-1' },
      data: {
        sourceUrl: generationUrl,
        upscaledUrl: null,
        upscaledStorageKey: null,
      },
    });
  });

  it('restores the manual upload of the item on revert', async () => {
    prisma.printProject.findUnique.mockResolvedValue(
      project({
        printImageUrl: 'https://cdn.example.com/master.jpg',
        printImageStorageKey: 'master.jpg',
        orderItem: orderItem({
          printImageUrl: 'https://cdn.example.com/master.jpg',
          printSourceUrl: 'https://cdn.example.com/manual.jpg',
          printSourceStorageKey: 'manual.jpg',
        }),
      }),
    );

    await service.revertEnhance('project-1');

    expect(storage.delete).toHaveBeenCalledWith('master.jpg');
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        printImageUrl: 'https://cdn.example.com/manual.jpg',
        printImageStorageKey: 'manual.jpg',
      },
    });
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
