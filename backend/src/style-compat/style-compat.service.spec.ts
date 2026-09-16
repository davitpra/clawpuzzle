import { NotFoundException } from '@nestjs/common';
import { StyleCompatService } from './style-compat.service';

describe('StyleCompatService', () => {
  const prisma = {
    style: { findFirst: jest.fn() },
    productReference: { findMany: jest.fn() },
  };
  const service = new StyleCompatService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a deterministic Digital create context', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([
      {
        id: 'digital-product',
        displayName: 'Digital portrait',
        template: 'Digital',
        artKind: 'pbn',
        productVariants: [
          {
            id: 'variant-1',
            formatId: 'format-1',
            format: { id: 'format-1', displayName: 'Digital' },
          },
        ],
      },
    ]);

    await expect(service.findCompatibleOptions('style-1')).resolves.toEqual(
      expect.objectContaining({
        styleId: 'style-1',
        defaultCreateContext: {
          productRefId: 'digital-product',
          formatId: 'format-1',
        },
      }),
    );
  });

  it('returns null when no Digital product can generate the style', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([]);

    const result = await service.findCompatibleOptions('style-1');

    expect(result.defaultCreateContext).toBeNull();
  });

  it('does not use a finished-art Digital product as PBN context', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([
      {
        id: 'print-product',
        displayName: 'Finished artwork',
        template: 'Digital',
        artKind: 'print',
        productVariants: [
          {
            id: 'variant-1',
            formatId: 'format-1',
            format: { id: 'format-1', displayName: 'Digital' },
          },
        ],
      },
    ]);

    const result = await service.findCompatibleOptions('style-1');

    expect(result.defaultCreateContext).toBeNull();
  });

  it('rejects inactive or missing styles', async () => {
    prisma.style.findFirst.mockResolvedValue(null);

    await expect(
      service.findCompatibleOptions('style-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
