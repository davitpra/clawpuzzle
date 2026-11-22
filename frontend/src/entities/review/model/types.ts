/** Una foto de cliente, tal como sale de Shopify Files. */
export interface ReviewImage {
  kind: "image";
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Un video de cliente: el mp4 elegido y su miniatura. */
export interface ReviewVideo {
  kind: "video";
  id: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  /** Miniatura que genera Shopify; `null` mientras el video se procesa. */
  poster: { url: string; width: number; height: number } | null;
  alt: string;
}

export type ReviewMedia = ReviewImage | ReviewVideo;

/** Una reseña de cliente: su foto o video y, si los tiene, frase y firma. */
export interface Review {
  id: string;
  media: ReviewMedia;
  /** La frase del cliente, sin comillas. */
  body: string | null;
  author: string | null;
  city: string | null;
  /** Estrellas de 0 a 5, ya llevadas a escala de 5; `null` si no tiene. */
  rating: number | null;
}
