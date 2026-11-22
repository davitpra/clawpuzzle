import { shopifyFetch } from "@/lib/shopify/client";
import { GET_REVIEWS } from "@/lib/shopify/queries/metaobjects";
import { mapReviews, type RawReviewMetaobject } from "../lib/mapReviews";
import type { Review } from "../model/types";

/**
 * Tipo de metaobject de las reseñas. Lleva el prefijo de la marca porque la
 * tienda de Shopify se comparte con Puzzle Salvaje.
 */
export const REVIEW_METAOBJECT_TYPE = "clawpuzzle_resena";

/**
 * Reseñas de clientes para la landing, desde los metaobjects
 * `clawpuzzle_resena`. Cacheado 5 minutos: un cambio en Shopify tarda hasta
 * eso en aparecer.
 */
export async function fetchReviews(): Promise<Review[]> {
  const response = await shopifyFetch<{
    metaobjects: { nodes: RawReviewMetaobject[] };
  }>({
    query: GET_REVIEWS,
    variables: { type: REVIEW_METAOBJECT_TYPE, first: 50 },
    revalidate: 300,
  });
  return mapReviews(response.data.metaobjects.nodes);
}
