import type { CartItem } from "@/context/CartContext";

export interface CheckoutLine {
  merchandiseId: string;
  quantity: number;
  attributes: { key: string; value: string }[];
}

/**
 * Líneas del carrito de Shopify a partir de nuestros items. Los attributes se
 * convierten en `properties` de la línea de la orden, que el webhook de
 * órdenes (`ingestLineItem`) lee para re-asociar el arte y la cuenta. Sin
 * `variantId` válido la línea se descarta: Shopify la rechazaría.
 *
 * Función pura, fuera de `useShopifyCheckout`, para poder testear el contrato
 * con el webhook sin montar los contextos de React.
 */
export function buildCheckoutLines(
  source: CartItem[],
  userId: string | null,
): CheckoutLine[] {
  return source
    .map((item) => {
      const attributes = [
        { key: "Style", value: item.style || "Default" },
        ...(item.size ? [{ key: "Size", value: item.size }] : []),
        // _user_id (prefijo "_" → Shopify lo oculta al cliente) permite al
        // webhook acreditar/vincular la orden a la cuenta correcta sin
        // depender del email tecleado en el checkout.
        ...(userId ? [{ key: "_user_id", value: userId }] : []),
        // Los ids y la URL de la obra también llevan "_": el webhook los
        // necesita, pero al cliente no le dicen nada en el checkout.
        ...(item.paintByNumbersId
          ? [{ key: "_paint_by_numbers_id", value: item.paintByNumbersId }]
          : []),
        ...(item.generationId
          ? [{ key: "_generation_id", value: item.generationId }]
          : []),
        ...(item.generationId && item.imageUrl
          ? [{ key: "_image_url", value: item.imageUrl }]
          : []),
      ];
      return {
        merchandiseId: item.variantId || "",
        quantity: item.quantity,
        attributes,
      };
    })
    .filter((line) => line.merchandiseId !== "");
}
