import type { FormatOption } from "@/hooks/useFormatOptions";

/**
 * Variante que se vende al final del embudo de lanzamiento: la que llegó desde
 * la ficha (`variantId`, p. ej. el tema Gato) si sigue a la venta en ese
 * formato; si no, la primera disponible del formato. Nunca otra variante
 * disponible cuando la pedida también lo está: el cliente eligió el tema y el
 * puzzle impreso debe coincidir con él.
 */
export function pickOfferVariant(
  formats: FormatOption[],
  formatId: string | null,
  variantId: string | null,
): FormatOption | null {
  const available = formats.filter(
    (f) => f.formatId === formatId && f.availableForSale,
  );
  return (
    available.find((f) => f.shopifyVariantId === variantId) ??
    available[0] ??
    null
  );
}
