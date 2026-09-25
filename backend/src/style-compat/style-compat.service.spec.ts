import { NotFoundException } from '@nestjs/common';
import { StyleCompatService } from './style-compat.service';

/**
 * `defaultCreateContext` es lo que resuelve el deep-link `/create?style_id=…`,
 * la entrada principal del embudo. Si devuelve null, el front muestra "este
 * estilo no está conectado a un producto" y no hay venta posible — y como es un
 * fallo de datos y no de tipos, no lo detecta ni el typecheck ni el build.
 * De ahí que esté cubierto aquí.
 */
describe('StyleCompatService', () => {
  const prisma = {
    style: { findFirst: jest.fn() },
    productReference: { findMany: jest.fn() },
  };
  const service = new StyleCompatService(prisma as never);

  const puzzleProduct = {
    id: 'puzzle-product',
    displayName: 'Custom pet puzzle',
    template: 'Puzzle',
    productVariants: [
      {
        id: 'variant-1',
        formatId: 'format-500',
        format: { id: 'format-500', displayName: '500 pieces' },
      },
    ],
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns a deterministic puzzle create context', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([puzzleProduct]);

    await expect(service.findCompatibleOptions('style-1')).resolves.toEqual(
      expect.objectContaining({
        styleId: 'style-1',
        defaultCreateContext: {
          productRefId: 'puzzle-product',
          formatId: 'format-500',
        },
      }),
    );
  });

  it('returns null when no puzzle product can generate the style', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([]);

    const result = await service.findCompatibleOptions('style-1');

    expect(result.defaultCreateContext).toBeNull();
  });

  it('does not use a non-puzzle product as create context', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([
      { ...puzzleProduct, id: 'credits-product', template: 'Credits' },
    ]);

    const result = await service.findCompatibleOptions('style-1');

    expect(result.defaultCreateContext).toBeNull();
  });

  it('ignores a puzzle product with no linked variants', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([
      { ...puzzleProduct, productVariants: [] },
    ]);

    const result = await service.findCompatibleOptions('style-1');

    expect(result.defaultCreateContext).toBeNull();
  });

  it('prefers the launch product over a style-specific puzzle', async () => {
    prisma.style.findFirst.mockResolvedValue({ id: 'style-1' });
    prisma.productReference.findMany.mockResolvedValue([
      puzzleProduct,
      {
        ...puzzleProduct,
        id: 'launch-product',
        isLaunchProduct: true,
        productVariants: [
          {
            id: 'variant-2',
            formatId: 'format-a3',
            format: { id: 'format-a3', displayName: 'A3' },
          },
        ],
      },
    ]);

    const result = await service.findCompatibleOptions('style-1');

    expect(result.defaultCreateContext).toEqual({
      productRefId: 'launch-product',
      formatId: 'format-a3',
    });
    expect(prisma.productReference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ styleId: 'style-1' }, { isLaunchProduct: true }],
        },
      }),
    );
  });

  it('rejects inactive or missing styles', async () => {
    prisma.style.findFirst.mockResolvedValue(null);

    await expect(
      service.findCompatibleOptions('style-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
