"use client";

import { useId } from "react";
import {
  puzzleGrooveStyle,
  puzzleHighlightStyle,
} from "@/entities/product/lib/frameStyle";

/**
 * Retícula de piezas superpuesta al arte: es lo que convierte "una imagen
 * bonita" en "un puzzle que quiero". Hereda la técnica de dos capas del canvas
 * de ClawAndSoul — `multiply` para el surco y `screen` para la luz del borde
 * superior de cada pieza — porque ninguna de las dos puede hacer el trabajo de
 * la otra.
 *
 * La densidad sale del número de piezas. Se renderiza dentro de un contenedor
 * con `position: relative`.
 */
export function PuzzlePieceOverlay({
  pieceCount = 500,
  aspectRatio = 4 / 3,
}: {
  /** Piezas del puzzle; define lo tupida que se ve la retícula. */
  pieceCount?: number;
  /** Ancho/alto del arte, para que las piezas salgan cuadradas y no estiradas. */
  aspectRatio?: number;
}) {
  // Un id por instancia: varias cards en la misma página no pueden compartir el
  // id del <pattern> o todas heredarían la retícula de la primera.
  const id = useId().replace(/:/g, "");

  // Piezas por fila/columna a partir del total, repartidas según el aspect
  // ratio. Un puzzle real reparte así: cols * rows ≈ total, cols/rows ≈ ratio.
  const cols = Math.max(2, Math.round(Math.sqrt(pieceCount * aspectRatio)));
  const rows = Math.max(2, Math.round(pieceCount / cols));
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={puzzleGrooveStyle}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <pattern
            id={`groove-${id}`}
            width={cellW}
            height={cellH}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M 0 0 H ${cellW} M 0 0 V ${cellH}`}
              stroke="rgba(0,0,0,0.30)"
              strokeWidth={0.22}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#groove-${id})`} />
      </svg>

      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={puzzleHighlightStyle}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <pattern
            id={`lip-${id}`}
            width={cellW}
            height={cellH}
            patternUnits="userSpaceOnUse"
          >
            {/* Desplazada un pelo bajo el surco: es la cara superior de la
                pieza de abajo captando la luz. */}
            <path
              d={`M 0 0.25 H ${cellW} M 0.25 0 V ${cellH}`}
              stroke="rgba(255,255,255,0.42)"
              strokeWidth={0.18}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#lip-${id})`} />
      </svg>
    </>
  );
}
