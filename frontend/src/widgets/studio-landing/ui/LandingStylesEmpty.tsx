"use client";

import { useRouter } from "next/navigation";

/**
 * Lo que ocupa el sitio del carrusel cuando no hay ningún estilo con imagen,
 * sea porque el backend no respondió o porque ninguno tiene una todavía.
 *
 * La sección `#styles` se renderiza siempre y por eso existe este componente:
 * si se ocultara, el ancla desaparecería con ella y los tres CTA que apuntan a
 * `#styles` —el botón principal del hero incluido— dejarían de hacer nada.
 *
 * Es cliente solo por el botón: `refresh()` vuelve a pedir el render del
 * servidor sin recargar la página entera ni perder el scroll.
 */
export function LandingStylesEmpty() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-md px-4 py-8 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--section-contrast,var(--color-cream))] text-slate-dark/40">
        <span className="material-symbols-outlined text-[32px]">palette</span>
      </span>
      <p className="mt-4 font-display text-xl font-black text-slate-dark">
        Art styles are on their way
      </p>
      <p className="mt-1 text-sm text-slate-dark/55">
        We couldn&apos;t load the art styles right now. Give it another try in a
        moment.
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
        Try again
      </button>
    </div>
  );
}
