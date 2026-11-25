"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

interface StepCarouselProps {
  /** Fila de título: a su derecha van las flechas en desktop. */
  heading?: ReactNode;
  /** Para el `aria-label` de las flechas: "Retratos anteriores"… */
  label: string;
  children: ReactNode;
}

const arrowButton =
  "flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#E0DED9] bg-white text-slate-dark transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white";

/**
 * Carrusel del paso de estilo de `/create`: dos tarjetas por vista en móvil y
 * cuatro en desktop, con las flechas junto al título (no sobre las imágenes).
 * Las flechas se ocultan cuando todo cabe.
 */
export function StepCarousel({ heading = null, label, children }: StepCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    update();
    emblaApi.on("select", update);
    emblaApi.on("reInit", update);
    return () => {
      emblaApi.off("select", update);
      emblaApi.off("reInit", update);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const hasArrows = canPrev || canNext;

  return (
    <div className="flex flex-col">
      {(heading || hasArrows) && (
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">{heading}</div>
          {hasArrows && (
            <div className="hidden shrink-0 gap-2 md:flex">
              <button
                type="button"
                onClick={scrollPrev}
                disabled={!canPrev}
                aria-label={`${label}: anteriores`}
                className={arrowButton}
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={scrollNext}
                disabled={!canNext}
                aria-label={`${label}: siguientes`}
                className={arrowButton}
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* `py-4`: aire para la sombra y el salto de las tarjetas al pasar el ratón. */}
      <div className="-mx-1 overflow-hidden px-1 py-4" ref={emblaRef}>
        <ul className="flex gap-4 md:gap-8 [&>*]:min-w-0 [&>*]:flex-[0_0_calc((100%-1rem)/2)] md:[&>*]:flex-[0_0_calc((100%-4rem)/3)] lg:[&>*]:flex-[0_0_calc((100%-6rem)/4)]">
          {children}
        </ul>
      </div>
    </div>
  );
}
