import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StyleCompatService {
  constructor(private prisma: PrismaService) {}

  async findCompatibleOptions(styleId: string) {
    const style = await this.prisma.style.findFirst({
      where: { id: styleId, isActive: true },
      select: { id: true },
    });
    if (!style) {
      throw new NotFoundException(`Style ${styleId} not found`);
    }

    // Productos con este estilo más el producto de lanzamiento, que admite
    // cualquier estilo activo; cada uno con sus variantes de formato.
    const products = await this.prisma.productReference.findMany({
      where: {
        isActive: true,
        OR: [{ styleId }, { isLaunchProduct: true }],
      },
      include: {
        productVariants: {
          where: { isActive: true, format: { isActive: true } },
          include: { format: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });

    // Deduplicate formats across all products
    const formatsMap = new Map<string, object>();
    for (const product of products) {
      for (const variant of product.productVariants) {
        formatsMap.set(variant.format.id, variant.format);
      }
    }

    // El producto de lanzamiento manda: es el que vende la landing. Sin él, el
    // primer Puzzle propio del estilo, como antes.
    const defaultProduct =
      products.find(
        (product) =>
          product.isLaunchProduct && product.productVariants.length > 0,
      ) ??
      products.find(
        (product) =>
          product.template === 'Puzzle' && product.productVariants.length > 0,
      );
    const defaultVariant = defaultProduct?.productVariants[0];

    return {
      styleId,
      formats: Array.from(formatsMap.values()),
      productReferences: products.map(({ productVariants: _v, ...p }) => p),
      defaultCreateContext:
        defaultProduct && defaultVariant
          ? {
              productRefId: defaultProduct.id,
              formatId: defaultVariant.formatId,
            }
          : null,
    };
  }
}
