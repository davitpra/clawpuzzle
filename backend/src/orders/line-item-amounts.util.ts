import { Prisma } from '@prisma/client';
import type { ShopifyLineItem } from './dto/shopify-order.dto';

export interface LineItemAmounts {
  /** Precio unitario cobrado, ya con los descuentos de la línea. */
  unitPrice: Prisma.Decimal;
  /** Lo cobrado por la línea: precio × cantidad − descuentos. */
  totalPrice: Prisma.Decimal;
}

/**
 * Descuento total de la línea. Los descuentos automáticos (p. ej. el bundle
 * "2 Mascotas" / "3 Mascotas") llegan en `discount_allocations`; el
 * `total_discount` de la línea suele venir en 0 para ellos, así que solo se
 * usa si no hay asignaciones (sumar ambos contaría dos veces lo mismo).
 */
function lineDiscount(lineItem: ShopifyLineItem): Prisma.Decimal {
  const allocations = lineItem.discount_allocations ?? [];
  if (allocations.length > 0) {
    return allocations.reduce(
      (sum, a) => sum.add(new Prisma.Decimal(a.amount || 0)),
      new Prisma.Decimal(0),
    );
  }
  return new Prisma.Decimal(lineItem.total_discount || 0);
}

/**
 * Importes de una línea de pedido de Shopify con sus descuentos aplicados: un
 * rompecabezas de $69,99 pedido en un bundle de 2 se guarda a $59,99.
 */
export function lineItemAmounts(lineItem: ShopifyLineItem): LineItemAmounts {
  const gross = new Prisma.Decimal(lineItem.price).mul(lineItem.quantity);
  const total = Prisma.Decimal.max(0, gross.sub(lineDiscount(lineItem)));
  const unitPrice =
    lineItem.quantity > 0
      ? total.div(lineItem.quantity).toDecimalPlaces(2)
      : new Prisma.Decimal(lineItem.price);
  return { unitPrice, totalPrice: total.toDecimalPlaces(2) };
}
