"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/shared/ui/Container";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { CRAFTING_MESSAGES } from "../model/crafting-messages";

/** Tiempo que el arte se queda en pantalla antes de saltar al studio. */
const REVEAL_MS = 2000;

interface IAGeneratingStepProps {
  generationId: string | null;
  styleId: string | null;
  /** Reintenta la generación fallida. Sin handler no se muestra el botón. */
  onRetry?: () => void;
  retrying?: boolean;
  retryError?: string | null;
}

/**
 * Último paso del embudo de lanzamiento: espera, revela el arte y lleva al studio.
 *
 * Deliberadamente **no** reutiliza `IAThanksStep`: aquel arrastra el mockup
 * enmarcado, el checkout del carrito y los CTAs de tienda, justo lo que el flujo
 * lineal del lanzamiento quiere fuera. Lo que sí comparte es el polling
 * (`useGenerationStatus`) y las frases rotativas.
 *
 * Tampoco ofrece cambiar de estilo: un estilo, una generación, a pintar.
 */
export function IAGeneratingStep({
  generationId,
  styleId,
  onRetry,
  retrying = false,
  retryError,
}: IAGeneratingStepProps) {
  const router = useRouter();
  const { status, imageUrl } = useGenerationStatus(generationId);

  const isFailed = status === "failed";
  const isGenerating = !!generationId && !imageUrl && !isFailed;
  const isRevealing = !!imageUrl;

  const craftingMessage = useRotatingMessage(CRAFTING_MESSAGES, {
    active: isGenerating,
  });

  // Al completar, el arte se queda un instante en pantalla y luego el studio lo
  // recoge. `replace` y no `push`: con `push`, volver atrás desde /studio caería
  // en esta misma pantalla ya completada y volvería a redirigir.
  useEffect(() => {
    if (!imageUrl) return;

    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ imageUrl });
      if (generationId) params.set("generationId", generationId);
      // El studio lee styleId para cargar el `pbnConfig` del estilo; sin él
      // procesaría con los valores por defecto genéricos.
      if (styleId) params.set("styleId", styleId);
      router.replace(`/studio?${params.toString()}`);
    }, REVEAL_MS);

    return () => clearTimeout(timeout);
  }, [imageUrl, generationId, styleId, router]);

  return (
    <main className="grow flex flex-col bg-white">
      <Container>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center animate-in fade-in duration-700">
          <div className="relative flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-3xl bg-cream/50">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Your pet's artwork"
                className="size-full object-cover animate-in fade-in zoom-in-95 duration-700"
                decoding="async"
              />
            ) : (
              <span
                className={`material-symbols-outlined text-6xl text-primary ${
                  isFailed ? "" : "animate-spin"
                }`}
              >
                {isFailed ? "error" : "progress_activity"}
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl font-black tracking-tight text-slate-dark md:text-5xl">
            {isRevealing
              ? "Your artwork is ready"
              : isFailed
                ? "That didn't work"
                : "Creating your artwork"}
          </h1>

          <p className="min-h-12 max-w-md text-base leading-relaxed text-slate-dark/70">
            {isRevealing ? (
              "Taking you to the studio to turn it into paint by numbers…"
            ) : isFailed ? (
              "Something went wrong while creating your artwork. Give it another go."
            ) : (
              <span
                key={craftingMessage}
                className="inline-block animate-in fade-in duration-700"
              >
                {craftingMessage}
              </span>
            )}
          </p>

          {isFailed && onRetry && (
            <div className="flex w-full max-w-xs flex-col items-center gap-3">
              <button
                onClick={onRetry}
                disabled={retrying}
                aria-busy={retrying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    retrying ? "animate-spin" : ""
                  }`}
                >
                  {retrying ? "progress_activity" : "refresh"}
                </span>
                {retrying ? "Retrying…" : "Try again"}
              </button>
              {retryError && (
                <p className="text-sm text-red-600">{retryError}</p>
              )}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
