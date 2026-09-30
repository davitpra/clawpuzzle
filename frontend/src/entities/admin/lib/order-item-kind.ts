import { AdminOrderItem } from "../api";

/**
 * Tipo de item de un pedido de cara al admin. `OrderItem` no lo guarda: se deriva
 * del `ProductReference` de la línea. Espejo de
 * `backend/src/orders/order-item-kind.util.ts`, donde el arte se llama `puzzle`.
 *
 * Solo el arte pasa por el flujo de producción; los créditos no se producen ni
 * se envían: se acreditan al pagarse.
 */
export type OrderItemKind = "art" | "credits";

export function orderItemKind(item: AdminOrderItem): OrderItemKind {
  const ref = item.productRef;
  // creditAmount solo llega cuando la variante comprada está mapeada al pack, así
  // que manda sobre las flags del producto.
  if (
    item.creditAmount != null ||
    ref?.isCreditPack ||
    ref?.template === "Credits"
  ) {
    return "credits";
  }
  return "art";
}
