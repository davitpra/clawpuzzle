"use client";

import Image from "next/image";
import { Carousel } from "@/shared/ui/Carousel";
import type { Review, ReviewMedia } from "@/entities/review/model/types";

/**
 * Mínimo de tarjetas para que el carrusel pueda dar la vuelta. Embla
 * desactiva el `loop` sin avisar cuando las tarjetas apenas llenan la vista
 * (5 reseñas con 4 visibles no alcanzan), así que con pocas se repiten.
 */
const MIN_LOOP_SLIDES = 8;

/** Separación entre tarjetas; `LAST_SLIDE_GAP` debe medir lo mismo. */
const SLIDE_GAP = "gap-4 md:gap-8";

/**
 * Margen derecho de la última tarjeta, igual al `gap`. En modo bucle Embla
 * coloca la primera tarjeta tras la última sumando ese margen (lo lee del
 * DOM); el `gap` del contenedor no existe después de la última, así que sin
 * él la última y la primera quedan pegadas.
 */
const LAST_SLIDE_GAP = "mr-4 md:mr-8";

/** Mismo reparto que el carrusel: 72% en móvil, 45% sm, 33% md, 1/4 en lg. */
const PHOTO_SIZES = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 45vw, 72vw";

/**
 * La foto, o el video con sus controles, dentro de la tarjeta. No se abre en
 * grande: la reseña se lee completa en el carrusel.
 */
function ReviewPhoto({ media }: { media: ReviewMedia }) {
  return (
    <div className="relative aspect-2/3 w-full overflow-hidden bg-slate-200">
      {media.kind === "image" ? (
        <Image
          src={media.url}
          alt={media.alt}
          fill
          sizes={PHOTO_SIZES}
          className="object-cover"
        />
      ) : (
        <video
          src={media.url}
          poster={media.poster?.url}
          // Sin miniatura de Shopify hace falta bajar los metadatos para
          // pintar el primer cuadro; con ella, nada hasta que se reproduce.
          preload={media.poster ? "none" : "metadata"}
          controls
          playsInline
          aria-label={media.alt}
          className="absolute inset-0 size-full bg-black object-cover"
        />
      )}
    </div>
  );
}

/** Cinco estrellas con las de la calificación en ámbar y el resto apagadas. */
function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <p
      role="img"
      aria-label={`Calificación: ${filled} de 5`}
      className="text-sm tracking-tight"
    >
      <span aria-hidden className="text-amber-500">
        {"★".repeat(filled)}
      </span>
      <span aria-hidden className="text-slate-dark/15">
        {"★".repeat(5 - filled)}
      </span>
    </p>
  );
}

function ReviewCard({
  review,
  isCopy = false,
  className = "",
}: {
  review: Review;
  /** Repetición para el bucle: se ve, pero los lectores de pantalla la saltan. */
  isCopy?: boolean;
  className?: string;
}) {
  const { media, body, author, city, rating } = review;
  const signature = [author, city].filter(Boolean).join(", ");

  return (
    <figure
      className={`flex flex-col ${className}`}
      aria-hidden={isCopy || undefined}
    >
      <ReviewPhoto media={media} />

      {(body || signature || rating !== null) && (
        <figcaption className="mt-4 flex flex-col gap-1">
          {body && (
            <blockquote className="font-display text-base font-medium leading-snug text-slate-dark md:text-lg">
              “{body}”
            </blockquote>
          )}
          {signature && (
            <cite className="text-sm not-italic text-slate-dark/55">
              {signature}
            </cite>
          )}
          {rating !== null && <Stars rating={rating} />}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Carrusel de reseñas: 4 por vista en escritorio, una con la siguiente
 * asomando en el celular. Da la vuelta: después de la última vuelve a salir
 * la primera.
 */
export function ReviewsGallery({ reviews }: { reviews: Review[] }) {
  const slides: { review: Review; key: string; isCopy: boolean }[] = [];
  // `reviews.length > 0`: sin reseñas el bucle no terminaría nunca.
  for (let round = 0; reviews.length > 0 && slides.length < MIN_LOOP_SLIDES; round++) {
    for (const review of reviews) {
      slides.push({ review, key: `${review.id}-${round}`, isCopy: round > 0 });
    }
  }

  return (
    <Carousel gap={SLIDE_GAP} perView={4} loop>
      {slides.map(({ review, key, isCopy }, index) => (
        <ReviewCard
          key={key}
          review={review}
          isCopy={isCopy}
          className={index === slides.length - 1 ? LAST_SLIDE_GAP : ""}
        />
      ))}
    </Carousel>
  );
}
