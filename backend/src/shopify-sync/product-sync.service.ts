import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ShopifyProductPayload,
  ShopifyVariant,
} from './dto/shopify-product.dto';

@Injectable()
export class ProductSyncService {
  private readonly logger = new Logger(ProductSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsertProduct(
    shopifyProduct: ShopifyProductPayload,
  ): Promise<{ action: 'created' | 'updated'; id: string }> {
    const shopifyProductId = String(shopifyProduct.id);
    const data = {
      name: shopifyProduct.handle,
      shopifyHandle: shopifyProduct.handle,
      displayName: shopifyProduct.title,
      description: this.stripHtml(shopifyProduct.body_html),
      isActive: shopifyProduct.status === 'active',
    };

    const existing = await this.prisma.productReference.findUnique({
      where: { shopifyProductId },
    });

    if (existing) {
      await this.prisma.productReference.update({
        where: { id: existing.id },
        data,
      });
      await this.writeAuditLog('product_sync_updated', existing.id);
      this.logger.debug(
        `Updated product ${shopifyProductId} (id: ${existing.id})`,
      );
      return { action: 'updated', id: existing.id };
    } else {
      const created = await this.prisma.productReference.create({
        data: { shopifyProductId, ...data },
      });
      await this.writeAuditLog('product_sync_created', created.id);
      this.logger.debug(
        `Created product ${shopifyProductId} (id: ${created.id})`,
      );
      return { action: 'created', id: created.id };
    }
  }

  async syncVariants(
    productRefId: string,
    variants: ShopifyVariant[],
    productName: string,
  ): Promise<{ synced: number; skipped: number }> {
    let synced = 0;

    const incomingVariantIds = variants.map((v) => String(v.id));

    // Todas las variantes heredan el formato (proporción) del producto: el
    // tamaño o el número de piezas de la variante no cambian la imagen a generar.
    const formatId = await this.resolveProductFormatId(productRefId);
    if (!formatId) {
      this.logger.warn(
        `Product '${productName}' has no format configured — skipping ${variants.length} variant(s)`,
      );
    } else {
      for (const variant of variants) {
        const shopifyVariantId = String(variant.id);
        await this.prisma.productFormatVariant.upsert({
          where: {
            productRefId_shopifyVariantId: { productRefId, shopifyVariantId },
          },
          create: {
            productRefId,
            formatId,
            shopifyVariantId,
            shopifyVariantTitle: variant.title,
            isActive: true,
          },
          // formatId no se toca: un override manual de la variante sobrevive al
          // sync, y cambiar el formato del producto ya lo propaga ProductsService.
          update: {
            shopifyVariantTitle: variant.title,
            isActive: true,
          },
        });

        synced++;
      }
    }

    // Deactivate variants that are no longer present in Shopify
    await this.prisma.productFormatVariant.updateMany({
      where: {
        productRefId,
        shopifyVariantId: { notIn: incomingVariantIds },
        isActive: true,
      },
      data: { isActive: false },
    });

    return { synced, skipped: variants.length - synced };
  }

  async softDeleteProduct(
    shopifyProductId: string,
  ): Promise<{ action: 'deactivated' | 'not_found'; id?: string }> {
    const existing = await this.prisma.productReference.findUnique({
      where: { shopifyProductId },
    });

    if (!existing || !existing.isActive) {
      return { action: 'not_found' };
    }

    await this.prisma.$transaction([
      this.prisma.productReference.update({
        where: { id: existing.id },
        data: { isActive: false },
      }),
      this.prisma.productFormatVariant.updateMany({
        where: { productRefId: existing.id },
        data: { isActive: false },
      }),
    ]);

    await this.writeAuditLog('product_sync_deactivated', existing.id);
    this.logger.debug(
      `Deactivated product ${shopifyProductId} (id: ${existing.id})`,
    );
    return { action: 'deactivated', id: existing.id };
  }

  /**
   * Formato del producto. Si aún no tiene (un producto recién llegado de
   * Shopify), se le asigna el formato activo más antiguo, que hace de formato
   * por defecto (`ratio_4_3` en el seed). Otro formato, como A3, lo elige el
   * admin en el producto.
   */
  private async resolveProductFormatId(
    productRefId: string,
  ): Promise<string | null> {
    const product = await this.prisma.productReference.findUnique({
      where: { id: productRefId },
      select: { formatId: true },
    });
    if (product?.formatId) return product.formatId;

    const fallback = await this.prisma.format.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fallback) return null;

    await this.prisma.productReference.update({
      where: { id: productRefId },
      data: { formatId: fallback.id },
    });
    return fallback.id;
  }

  private stripHtml(html: string): string {
    return html?.replace(/<[^>]*>/g, '').trim() ?? '';
  }

  private async writeAuditLog(action: string, entityId: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action,
        entityType: 'ProductReference',
        entityId,
      },
    });
  }
}
