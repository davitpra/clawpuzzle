"use client";

import { SetLighting } from "@/entities/product/ui/SetLighting";
import { setArtworkFilter } from "@/entities/product/lib/setLighting";

// Escala de la imagen del producto centrada según el formato elegido. Tuneables:
const BASE_WIDTH_PCT = 90; // % del panel que ocupa el lado mayor del formato de referencia
const REFERENCE_MAX_CM = 50; // lado (cm) del formato que alcanza BASE_WIDTH_PCT
const MIN_SCALE = 0.4; // el formato más pequeño nunca baja de esto

interface FormatArtworkProps {
  /** Imagen generada, o la foto del producto mientras se genera. */
  image: string | null;
  formatWidth?: number | null;
  formatHeight?: number | null;
  /** Pinta un velo pulsante sobre la imagen (o un spinner si aún no hay). */
  isGenerating: boolean;
  alt?: string;
}

/**
 * Columna izquierda de los pasos de resultado: el arte colgado en la escena,
 * con la proporción real del formato y escalado a su tamaño físico.
 */
export function FormatArtwork({
  image,
  formatWidth,
  formatHeight,
  isGenerating,
  alt = "Tu arte personalizado",
}: FormatArtworkProps) {
  // El cuadro adopta la proporción real del formato y escala con su tamaño
  // físico (lado mayor). Sin dimensiones válidas caemos al ancho base con la
  // proporción natural de la imagen.
  const hasDims =
    !!formatWidth && !!formatHeight && formatWidth > 0 && formatHeight > 0;
  let widthPct = BASE_WIDTH_PCT;
  let aspectRatio: string | undefined;
  if (hasDims) {
    const w = formatWidth as number;
    const h = formatHeight as number;
    const longSide = Math.max(w, h);
    const scale = Math.min(Math.max(longSide / REFERENCE_MAX_CM, MIN_SCALE), 1);
    // El lado mayor ocupa la misma huella sin importar la orientación: en
    // retrato es la altura, así que reducimos el ancho por (w/h).
    widthPct =
      w >= h ? BASE_WIDTH_PCT * scale : BASE_WIDTH_PCT * scale * (w / h);
    aspectRatio = `${w} / ${h}`;
  }

  return (
    <div className="w-full md:w-1/2 bg-white flex items-center justify-center min-h-72 md:min-h-0">
      <div className="relative flex items-center justify-center overflow-hidden bg-white w-full max-w-2xl aspect-3/4 max-h-screen">
        {image ? (
          // Imagen del producto centrada y escalada a la proporción y al
          // tamaño del formato elegido. Conserva sombra + lienzo + luz.
          <SetLighting
            style={{
              width: `${widthPct}%`,
              ...(aspectRatio ? { aspectRatio } : {}),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={image}
              src={image}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={`animate-in fade-in duration-700 ${
                aspectRatio
                  ? "block h-full w-full object-cover"
                  : "block h-auto w-full"
              }`}
              style={setArtworkFilter}
            />
            {isGenerating && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-pulse bg-white/40"
              />
            )}
          </SetLighting>
        ) : (
          isGenerating && (
            <span className="material-symbols-outlined animate-spin text-6xl text-primary">
              progress_activity
            </span>
          )
        )}
      </div>
    </div>
  );
}
