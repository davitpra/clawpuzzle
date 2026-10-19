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

describe('StylesService display order', () => {
  const prisma = {
    style: {
      count: jest.fn(),
      update: jest.fn((args: unknown) => args),
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new StylesService(prisma as never, {} as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(service, 'findAllForAdmin').mockResolvedValue([] as never);
  });

  it('writes each id position as its sortOrder in one transaction', async () => {
    prisma.style.count.mockResolvedValue(3);

    await service.reorder(['c', 'a', 'b']);

    expect(prisma.style.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 'c' }, data: { sortOrder: 0 } },
      { where: { id: 'a' }, data: { sortOrder: 1 } },
      { where: { id: 'b' }, data: { sortOrder: 2 } },
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects the reorder when an id does not exist', async () => {
    prisma.style.count.mockResolvedValue(1);

    await expect(service.reorder(['a', 'missing'])).rejects.toThrow(
      'Some style ids do not exist',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('places a new style after the current last one', async () => {
    prisma.style.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });

    await service.create({ name: 'new' } as never);

    expect(prisma.style.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 5 }) as unknown,
      }),
    );
  });
});
