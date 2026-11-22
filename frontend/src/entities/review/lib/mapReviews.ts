import type { Review, ReviewMedia } from "../model/types";

/** Nodo de media tal como lo devuelve `GET_REVIEWS`. */
export interface RawReviewMediaNode {
  __typename?: string;
  id?: string;
  alt?: string | null;
  image?: {
    url: string;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
  } | null;
  previewImage?: {
    url: string;
    width?: number | null;
    height?: number | null;
  } | null;
  sources?: {
    url: string;
    mimeType: string;
    width?: number | null;
    height?: number | null;
  }[];
}

type RawTextField = { value?: string | null } | null;

export interface RawReviewMetaobject {
  id: string;
  body?: RawTextField;
  author?: RawTextField;
  city?: RawTextField;
  raiting?: RawTextField;
  rating?: RawTextField;
  media?: {
    reference?: RawReviewMediaNode | null;
    references?: { nodes: RawReviewMediaNode[] } | null;
  } | null;
}

/**
 * Lado corto máximo del mp4 que se sirve. Shopify transcodifica cada video a
 * varias resoluciones; 1080 se ve nítido a pantalla completa en el celular
 * sin bajar el original de 4K.
 */
const MAX_VIDEO_SHORT_SIDE = 1080;

type VideoSource = NonNullable<RawReviewMediaNode["sources"]>[number];

function shortSide(source: VideoSource): number {
  return Math.min(source.width ?? 0, source.height ?? 0);
}

/**
 * El mp4 más grande que no pase de `MAX_VIDEO_SHORT_SIDE`; si todos lo pasan,
 * el más chico. El HLS (`application/x-mpegURL`) se descarta: fuera de Safari
 * no se reproduce en un `<video>` sin librería.
 */
export function pickVideoSource(
  sources: VideoSource[] = [],
): VideoSource | null {
  const mp4 = sources
    .filter((s) => s.mimeType === "video/mp4")
    .sort((a, b) => shortSide(b) - shortSide(a));
  if (mp4.length === 0) return null;
  return (
    mp4.find((s) => shortSide(s) <= MAX_VIDEO_SHORT_SIDE) ?? mp4[mp4.length - 1]
  );
}

function mapMedia(
  node: RawReviewMediaNode,
  fallbackAlt: { image: string; video: string },
): ReviewMedia | null {
  if (!node.id) return null;

  if (node.__typename === "MediaImage") {
    // `image` es null mientras Shopify todavía procesa el archivo.
    if (!node.image?.url) return null;
    return {
      kind: "image",
      id: node.id,
      url: node.image.url,
      width: node.image.width ?? 1000,
      height: node.image.height ?? 1500,
      alt: node.alt || node.image.altText || fallbackAlt.image,
    };
  }

  if (node.__typename === "Video") {
    const source = pickVideoSource(node.sources);
    if (!source) return null;
    const poster = node.previewImage?.url
      ? {
          url: node.previewImage.url,
          width: node.previewImage.width ?? source.width ?? 1080,
          height: node.previewImage.height ?? source.height ?? 1920,
        }
      : null;
    return {
      kind: "video",
      id: node.id,
      url: source.url,
      mimeType: source.mimeType,
      width: source.width ?? 1080,
      height: source.height ?? 1920,
      poster,
      alt: node.alt || fallbackAlt.video,
    };
  }

  // Otros tipos de archivo (PDF, GenericFile…) no se muestran.
  return null;
}

function text(field: RawTextField | undefined): string | null {
  const value = field?.value?.trim();
  return value ? value : null;
}

/**
 * El valor de un campo "Calificación" de Shopify es un JSON como
 * `{"scale_min":"1.0","scale_max":"5.0","value":"4.0"}`. Se lleva a escala de
 * 5 y se acota a 0–5; un valor ilegible cuenta como sin calificación.
 */
export function parseRating(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value?: string; scale_max?: string };
    const value = Number(parsed.value);
    const max = Number(parsed.scale_max ?? 5) || 5;
    if (!Number.isFinite(value)) return null;
    return Math.min(5, Math.max(0, (value / max) * 5));
  } catch {
    return null;
  }
}

/**
 * Una reseña por metaobject, en el orden de Shopify. Lleva el primer archivo
 * válido de su campo `media`; una entrada sin foto ni video no se muestra.
 * Los textos son opcionales: vacíos llegan como `null`.
 */
export function mapReviews(metaobjects: RawReviewMetaobject[]): Review[] {
  const reviews: Review[] = [];
  for (const metaobject of metaobjects) {
    const author = text(metaobject.author);
    const who = author ? ` de ${author}` : " de un cliente";
    const fallbackAlt = {
      image: `Foto${who} con el rompecabezas de su mascota`,
      video: `Video${who} con el rompecabezas de su mascota`,
    };

    const field = metaobject.media;
    const nodes = field?.references?.nodes?.length
      ? field.references.nodes
      : field?.reference
        ? [field.reference]
        : [];
    const media = nodes
      .map((node) => mapMedia(node, fallbackAlt))
      .find((m): m is ReviewMedia => m !== null);
    if (!media) continue;

    reviews.push({
      id: metaobject.id,
      media,
      // Las comillas las pone la UI: si el cliente ya las escribió, fuera.
      body: text(metaobject.body)?.replace(/^["“”«]+|["“”»]+$/g, "").trim() || null,
      author,
      city: text(metaobject.city),
      rating: parseRating(text(metaobject.raiting) ?? text(metaobject.rating)),
    });
  }
  return reviews;
}
