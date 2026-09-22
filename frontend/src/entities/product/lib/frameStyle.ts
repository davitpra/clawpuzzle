import type { CSSProperties } from "react";
import type { StyleData } from "@/entities/product/model/styleData";

/** Presentation applied to the product image based on the product type. */
export type FrameStyle = "puzzle" | "art" | "credits";

// Solo un template explícito recibe presentación propia; cualquier otro valor
// (o uno desconocido) se queda plano ("art").
export function toFrameStyle(template?: string | null): FrameStyle {
  if (template === "Puzzle") return "puzzle";
  if (template === "Credits") return "credits";
  return "art";
}

// Resuelve el marco visual de una card a partir del `shopifyHandle` de un
// producto, cruzándolo con el template del backend (`styleData`). Se usa donde
// el dato no viene con el producto (ítems de orden). Sin dato → "art" plano.
export function frameForHandle(
  handle: string | null | undefined,
  styleData: StyleData | null,
): { frameStyle: FrameStyle; naturalAspect: boolean } {
  const template = !handle
    ? ""
    : handle === styleData?.creditPackHandle
      ? "Credits"
      : (styleData?.templateByHandle.get(handle) ?? "");
  return {
    frameStyle: toFrameStyle(template),
    naturalAspect: template !== "",
  };
}

// Presentación por tipo. "art" mantiene el float plano original; "puzzle" añade
// un float direccional (la retícula de piezas es un overlay aparte, ver
// `PuzzlePieceOverlay`); "credits" tiene su propio layout de moneda flotante en
// ProductCard, así que su entrada aquí es un fallback inerte que replica "art".
export const FRAME_SHADOWS: Record<FrameStyle, string> = {
  art: "shadow-[0_14px_32px_-12px_rgba(16,54,66,0.40)]",
  puzzle: "shadow-[6px_10px_24px_-10px_rgba(16,54,66,0.45)]",
  credits: "shadow-[0_14px_32px_-12px_rgba(16,54,66,0.40)]",
};

// Los surcos entre piezas. Un box-shadow inset no pinta sobre un <img> (el
// contenido de la imagen se pinta encima), así que la retícula se superpone
// como gradientes multiplicados sobre el arte.
//
// Son dos capas y no una por la misma razón que en un canvas enmarcado:
// `multiply` solo puede oscurecer, así que la luz que corre por el borde
// superior de cada pieza necesita una capa `screen` aparte, que solo aclara.
// Ver `puzzleHighlightStyle`.
export const puzzleGrooveStyle: CSSProperties = {
  mixBlendMode: "multiply",
};

export const puzzleHighlightStyle: CSSProperties = {
  mixBlendMode: "screen",
};

// Sombra del puzzle armado sobre la mesa, para contextos recortados como la
// galería del mismo estilo.
export const PUZZLE_THUMB_FRAME = "shadow-[0_6px_16px_-8px_rgba(16,54,66,0.35)]";
