/**
 * Tipo de item de un pedido. `OrderItem` no lo guarda: se deriva del
 * `ProductReference` de la línea. Espejo de
 * `frontend/src/entities/admin/lib/order-item-kind.ts` (mismo orden de reglas).
 *
 * Solo el puzzle pasa por el flujo de producción; los créditos no se producen
 * ni se envían: se acreditan en el momento del pago.
 *
 * ClawAndSoul tenía un tercer tipo, `accessory`, con su propia máquina de
 * estados reducida. ClawPuzzle no vende accesorios, así que queda una sola
 * máquina — ver `production-status.util.ts`.
 */
export type OrderItemKind = 'puzzle' | 'credits';

export function orderItemKind(
  ref: {
    isCreditPack: boolean;
    template: string | null;
  } | null,
): OrderItemKind {
  if (ref?.isCreditPack || ref?.template === 'Credits') return 'credits';
  return 'puzzle';
}
