jest.mock('uuid', () => ({ v4: () => 'image-id' }));

import { StylesService } from './styles.service';

interface CreateImageArgs {
  data: {
    orderIndex: number;
    isPrimary: boolean;
    [key: string]: unknown;
  };
}

describe('StylesService image catalog', () => {
  const prisma = {
    styleImage: {
      findFirst: jest.fn(),
      create: jest.fn<Promise<{ id: string }>, [CreateImageArgs]>(),
    },
  };
  const storage = {
    upload: jest.fn().mockResolvedValue('https://example.com/image.webp'),
  };
  const service = new StylesService(
    prisma as never,
    storage as never,
    {} as never,
  );
  const file = {
    buffer: Buffer.from('image'),
    mimetype: 'image/webp',
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    prisma.styleImage.create.mockResolvedValue({ id: 'image-1' });
  });

  it('makes the first uploaded image primary at position zero', async () => {
    prisma.styleImage.findFirst.mockResolvedValue(null);

    await service.addImage('style-1', file, 'Finished art');

    const createArgs: unknown = prisma.styleImage.create.mock.calls[0]?.[0];
    expect(createArgs).toMatchObject({
      data: { orderIndex: 0, isPrimary: true },
    });
  });

  it('appends later uploads after the current highest position', async () => {
    prisma.styleImage.findFirst.mockResolvedValue({ orderIndex: 1 });

    await service.addImage('style-1', file, 'Numbered art');

    const createArgs: unknown = prisma.styleImage.create.mock.calls[0]?.[0];
    expect(createArgs).toMatchObject({
      data: { orderIndex: 2, isPrimary: false },
    });
  });
});
