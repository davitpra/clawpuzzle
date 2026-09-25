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

// Presentación por tipo. "art" mantiene el float plano original; "puzzle" va
// sin sombra porque su foto ya trae escena propia; "credits" tiene su propio
// layout de moneda flotante en ProductCard, así que su entrada aquí es un
// fallback inerte que replica "art".
export const FRAME_SHADOWS: Record<FrameStyle, string> = {
  art: "shadow-[0_14px_32px_-12px_rgba(16,54,66,0.40)]",
  puzzle: "",
  credits: "shadow-[0_14px_32px_-12px_rgba(16,54,66,0.40)]",
};
