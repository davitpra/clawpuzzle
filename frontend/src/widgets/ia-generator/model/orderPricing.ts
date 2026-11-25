import { bundlePrice, type BundlePrice } from "@/entities/product/lib/bundle";
import { splitDeposit } from "@/entities/product/lib/deposit";
import { formatPrice } from "@/entities/product/lib/variantPresentation";
import type { PuzzleOffer } from "../ui/IAGeneratingStep";

export interface OrderPricing extends BundlePrice {
  /** Precio unitario de la oferta, sin descuento; 0 si no se pudo leer. */
  listPrice: number;
  /** Hoy, para empezar (70/30). */
  deposit: number;
  /** Al recibir, en efectivo. */
  dueOnDelivery: number;
  /** Precio de referencia tachado: N × compare-at ($100). */
  compareAtTotal: number;
  /** Ahorro frente al tachado, redondeado hacia abajo a dólares, como en la ficha. */
  savings: number;
  money: (amount: number) => string;
}

/** Total, anticipo y saldo de `quantity` rompecabezas de la oferta. */
export function orderPricing(
  offer: PuzzleOffer | null,
  quantity: number,
): OrderPricing {
  const listPrice = offer ? Number.parseFloat(offer.price) || 0 : 0;
  const pricing = bundlePrice(listPrice, quantity);
  const { deposit, balance } = splitDeposit(pricing.total);
  const compareAtTotal =
    (offer?.compareAtPrice ? Number.parseFloat(offer.compareAtPrice) || 0 : 0) *
    quantity;
  return {
    ...pricing,
    listPrice,
    deposit,
    dueOnDelivery: balance,
    compareAtTotal,
    savings:
      compareAtTotal > pricing.total
        ? Math.floor(compareAtTotal - pricing.total)
        : 0,
    money: (n: number) =>
      formatPrice(n, offer?.currencyCode ?? "USD", { trimZeroCents: true }),
  };
}
