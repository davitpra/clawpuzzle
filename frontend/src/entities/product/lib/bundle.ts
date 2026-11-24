/**
 * Bundle por cantidad del rompecabezas: 1 = $69,99, 2 = $120, 3 = $150.
 *
 * Quien cobra es Shopify, con dos descuentos automáticos solo sobre el producto
 * `claw-puzzle` (la tienda se comparte con Puzzle Salvaje): "Compra 2" (mínimo
 * 2 unidades, $9,99 menos en cada una) y "Compra 3" (mínimo 3, $19,99 menos en
 * cada una). Esta tabla solo lo muestra y **tiene que coincidir con ellos**: si
 * cambia un descuento o el precio en Shopify, cambia aquí también.
 *
 * Shopify suma las unidades de todas las líneas del producto, así que un pedido
 * de tres retratos distintos (tres líneas de 1) califica igual que una línea de 3.
 */
export const BUNDLE_QUANTITIES = [1, 2, 3] as const;
export type BundleQuantity = (typeof BUNDLE_QUANTITIES)[number];

/** Descuento por unidad según la cantidad; gana el tramo más alto alcanzado. */
const UNIT_DISCOUNTS: { minQuantity: number; amount: number }[] = [
  { minQuantity: 3, amount: 19.99 },
  { minQuantity: 2, amount: 9.99 },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Descuento que Shopify aplica a cada unidad al llevar `quantity`. */
export function bundleUnitDiscount(quantity: number): number {
  return UNIT_DISCOUNTS.find((d) => quantity >= d.minQuantity)?.amount ?? 0;
}

export interface BundlePrice {
  /** Precio de cada rompecabezas con el descuento del tramo. */
  unitPrice: number;
  /** Lo que cobra Shopify por las `quantity` unidades. */
  total: number;
  /** Lo que costarían sin bundle (`quantity` × precio unitario). */
  regularTotal: number;
  savings: number;
}

/** Precio del bundle para `quantity` rompecabezas de `unitPrice` cada uno. */
export function bundlePrice(unitPrice: number, quantity: number): BundlePrice {
  const discountedUnit = round2(
    Math.max(0, unitPrice - bundleUnitDiscount(quantity)),
  );
  const total = round2(discountedUnit * quantity);
  const regularTotal = round2(unitPrice * quantity);
  return {
    unitPrice: discountedUnit,
    total,
    regularTotal,
    savings: round2(regularTotal - total),
  };
}

/**
 * Cantidad elegida en la landing, que viaja como `qty` en la URL de `/create`.
 * Cualquier valor fuera de 1–3 cae a 1.
 */
export function parseBundleQuantity(value: string | null | undefined): BundleQuantity {
  const n = Number(value);
  return (BUNDLE_QUANTITIES as readonly number[]).includes(n)
    ? (n as BundleQuantity)
    : 1;
}
