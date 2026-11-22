import { Container } from "@/shared/ui/Container";
import type { Review } from "@/entities/review/model/types";
import { ReviewsGallery } from "./ReviewsGallery";

/**
 * Calificación general bajo el título. Son cifras de la marca, no se calculan
 * de las reseñas cargadas en Shopify: actualizarlas aquí cuando cambien.
 */
const RATING = { average: "4.9", customers: "+100" };

interface CustomerReviewsProps {
  reviews: Review[];
  background?: string;
}

/**
 * Sección de reseñas de clientes de la landing. Recibe las reseñas ya
 * cargadas: quien la monta decide con ellas si la sección va o no (`when` de
 * `SectionFlow`), en vez de que la sección se oculte sola y descuadre la
 * alternancia de fondos.
 */
export default function CustomerReviews({
  reviews,
  background = "",
}: CustomerReviewsProps) {
  return (
    <section
      id="reviews"
      className={`relative w-full scroll-mt-24 overflow-hidden pt-12 pb-20 md:pt-20 ${background}`}
    >
      <Container>
        <div className="mb-6 text-center md:mb-12">
          <span className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary md:mb-5">
            Clientes felices
          </span>
          <h2 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
            Así quedan en casa
          </h2>
          <p className="mt-4 flex items-center justify-center gap-2 text-base text-slate-dark/60">
            <span aria-hidden className="tracking-tight text-amber-500">
              ★★★★★
            </span>
            <span>
              <span className="sr-only">Calificación de </span>
              {RATING.average} de 5 · {RATING.customers} clientes
            </span>
          </p>
        </div>

        <ReviewsGallery reviews={reviews} />
      </Container>
    </section>
  );
}
