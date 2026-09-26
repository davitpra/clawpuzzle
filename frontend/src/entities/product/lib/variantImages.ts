import type { ShopifyProduct } from "@/lib/shopify";

/**
 * Fotos del producto que corresponden a la imagen de una variante.
 *
 * Shopify solo liga una imagen por variante, así que el resto se agrupa por el
 * orden de la galería: cada imagen de variante abre su grupo, que sigue hasta
 * la imagen de la siguiente variante, y las fotos anteriores a la primera van
 * con ella. Así, en `claw-puzzle` (perro, perro*, gato*, gato) el tema Perro
 * enseña solo perros y Gato solo gatos.
 *
 * Si la variante no tiene imagen propia, o ninguna variante la tiene, se
 * devuelve la galería completa.
 */
export function getVariantImages(
  product: ShopifyProduct,
  variantImage?: string | null,
): string[] {
  const all = product.images.edges.map((edge) => edge.node.url);
  if (!variantImage) return all;

  const variantImageUrls = new Set(
    product.variants.edges
      .map((v) => v.node.image?.url)
      .filter((url): url is string => Boolean(url)),
  );
  const starts = all
    .map((url, i) => (variantImageUrls.has(url) ? i : -1))
    .filter((i) => i >= 0);

  const index = all.indexOf(variantImage);
  if (index === -1 || starts.length === 0) {
    return [variantImage, ...all.filter((url) => url !== variantImage)];
  }

  const groupStart = starts[0] === index ? 0 : index;
  const groupEnd = starts.find((i) => i > index) ?? all.length;
  const group = all.slice(groupStart, groupEnd);

  // La imagen de la variante va primero.
  return [variantImage, ...group.filter((url) => url !== variantImage)];
}
