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

    // Products that carry this style, with their available format variants
    const products = await this.prisma.productReference.findMany({
      where: { styleId, isActive: true },
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

    const defaultProduct = products.find(
      (product) =>
        product.template?.toLowerCase() === 'digital' &&
        product.artKind?.toLowerCase() === 'pbn' &&
        product.productVariants.length > 0,
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
