// Encuadre del Print Studio. Independiente de la resolución: el mismo encuadre
// vale para el original y para la base agrandada con IA. El frontend replica
// este cálculo en print-studio/_components/printStudio.ts — editar ambos juntos.

export interface PrintCrop {
  /** Centro del recorte, en fracción del ancho de la imagen (0–1). */
  x: number;
  /** Centro del recorte, en fracción del alto de la imagen (0–1). */
  y: number;
  /** 1 = el rect más grande con la proporción del formato ("cubrir"). */
  zoom: number;
}

export const CENTER_CROP: PrintCrop = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_CROP_ZOOM = 3;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Rect en px que recorta la imagen a la proporción `printRatio` (ancho/alto)
 * según el encuadre. El centro se ajusta para que el rect no salga de la imagen.
 */
export function cropRect(
  imgW: number,
  imgH: number,
  printRatio: number,
  crop: PrintCrop = CENTER_CROP,
): { left: number; top: number; width: number; height: number } {
  const zoom = clamp(crop.zoom, 1, MAX_CROP_ZOOM);
  const coverW = imgW / imgH > printRatio ? imgH * printRatio : imgW;
  const coverH = coverW / printRatio;
  const width = Math.max(1, Math.min(imgW, Math.round(coverW / zoom)));
  const height = Math.max(1, Math.min(imgH, Math.round(coverH / zoom)));
  const left = Math.round(clamp(crop.x * imgW - width / 2, 0, imgW - width));
  const top = Math.round(clamp(crop.y * imgH - height / 2, 0, imgH - height));
  return { left, top, width, height };
}

/** Lee el encuadre guardado en `OrderItem.printCrop`; null si no es válido. */
export function parsePrintCrop(value: unknown): PrintCrop | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y, zoom } = value as Record<string, unknown>;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof zoom !== 'number'
  ) {
    return null;
  }
  return { x, y, zoom };
}
