// Constantes y geometría pura del estudio de impresión. Extraído de
// Print Studio para separar el cálculo (sin estado) de la UI.
import type { EnhanceInfo, PrintCrop } from "@/entities/admin/api";

export const GOOD_DPI = 300;
export const LOW_DPI = 200;
// Resolution the backend caps the saved print master at (matches PRINT_DPI server-side).
export const PRINT_DPI = 300;
export const DEFAULT_UPSCALE_FACTOR = 2;
// Rango del slider de upscale.
export const UPSCALE_STEP = 0.5;
export const MAX_UPSCALE_FACTOR = 8;
// Sangre fija por lado; coincide con BLEED_MM del backend.
export const BLEED_MM = 3;
// Margen de seguridad dentro de la línea de corte.
const SAFE_MARGIN_MM = 10;
// Diferencia de proporción por debajo de la cual no se avisa de recorte
// (redondeos de píxeles, no un recorte real).
const ASPECT_TOLERANCE = 0.005;

type Px = { w: number; h: number };
type Inches = { width: number; height: number };

// ── Encuadre ("Ajustar al formato") ───────────────────────────────────────
// Réplica de backend/src/orders/print-crop.util.ts — editar ambos juntos.
export const CENTER_CROP: PrintCrop = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_CROP_ZOOM = 3;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

// Rect del recorte en fracciones de la imagen (0–1). zoom 1 = el rect más
// grande con la proporción del formato; el centro se ajusta para no salirse.
export function cropRect(
  imgPx: Px,
  printInches: Inches,
  crop: PrintCrop = CENTER_CROP,
): { left: number; top: number; width: number; height: number } {
  const imageRatio = imgPx.w / imgPx.h;
  const printRatio = printInches.width / printInches.height;
  const zoom = clamp(crop.zoom, 1, MAX_CROP_ZOOM);
  const width = (imageRatio > printRatio ? printRatio / imageRatio : 1) / zoom;
  const height = (imageRatio > printRatio ? 1 : imageRatio / printRatio) / zoom;
  return {
    left: clamp(crop.x - width / 2, 0, 1 - width),
    top: clamp(crop.y - height / 2, 0, 1 - height),
    width,
    height,
  };
}

// Encuadre equivalente con el centro dentro de los límites: al arrastrar, el
// estado no se aleja del borde aunque el puntero sí.
export function clampCrop(
  crop: PrintCrop,
  imgPx: Px,
  printInches: Inches,
): PrintCrop {
  const rect = cropRect(imgPx, printInches, crop);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    zoom: clamp(crop.zoom, 1, MAX_CROP_ZOOM),
  };
}

export function dpiTone(
  dpi: number | null,
): "success" | "warning" | "critical" {
  if (dpi === null || dpi < LOW_DPI) return "critical";
  if (dpi < GOOD_DPI) return "warning";
  return "success";
}

// El veredicto de dpiTone en palabras, para no depender solo del color.
export function dpiVerdict(dpi: number | null): string {
  if (dpi === null || dpi < LOW_DPI) return "Baja: haz upscale";
  if (dpi < GOOD_DPI) return `Aceptable (óptima ≥${GOOD_DPI})`;
  return `Óptima (≥${GOOD_DPI})`;
}

export const inchesToCm = (inches: number) =>
  Math.round(inches * 2.54 * 10) / 10;

// "20 × 30 cm" — el admin elige el tamaño en cm, así que se muestra en cm.
export function formatPrintSize(printInches: Inches): string {
  const fmt = (inches: number) => inchesToCm(inches).toLocaleString("es");
  return `${fmt(printInches.width)} × ${fmt(printInches.height)} cm`;
}

// DPI efectivo de una imagen que cubre el formato: manda el eje más justo.
// Redondeado: un máster de 2362 px a 20 cm son 299,97 DPI, no 299.
export function dpiFor(px: Px, printInches: Inches): number {
  return Math.round(
    Math.min(px.w / printInches.width, px.h / printInches.height),
  );
}

export interface AspectCrop {
  // Eje que se recorta: "w" pierde izquierda/derecha, "h" arriba/abajo.
  axis: "w" | "h";
  // Fracción del eje recortado que se pierde por cada lado (0–0,5).
  perSide: number;
}

// Recorte centrado que sufre una imagen al cubrir el formato, o null si la
// proporción coincide.
export function computeAspectCrop(
  px: Px,
  printInches: Inches,
): AspectCrop | null {
  const imageRatio = px.w / px.h;
  const printRatio = printInches.width / printInches.height;
  if (Math.abs(imageRatio / printRatio - 1) < ASPECT_TOLERANCE) return null;
  return imageRatio > printRatio
    ? { axis: "w", perSide: (1 - printRatio / imageRatio) / 2 }
    : { axis: "h", perSide: (1 - imageRatio / printRatio) / 2 };
}

// Tamaño del máster que guardará el backend (`buildPrintImage`): se limita a
// PRINT_DPI cubriendo el formato y nunca se agranda. Con fitToFormat se recorta
// el encuadre a la proporción exacta (con zoom quedan menos píxeles); con bleed
// se extiende BLEED_MM por lado.
export function savedMasterPx(
  basePx: Px,
  printInches: Inches,
  opts: { fitToFormat: boolean; bleed: boolean; crop?: PrintCrop },
): Px {
  const maxW = Math.round(printInches.width * PRINT_DPI);
  const maxH = Math.round(printInches.height * PRINT_DPI);
  let px: Px;
  if (opts.fitToFormat) {
    const rect = cropRect(basePx, printInches, opts.crop);
    const factor = Math.min(
      1,
      (basePx.w * rect.width) / maxW,
      (basePx.h * rect.height) / maxH,
    );
    px = {
      w: Math.max(1, Math.round(maxW * factor)),
      h: Math.max(1, Math.round(maxH * factor)),
    };
  } else {
    const scale = Math.min(1, Math.max(maxW / basePx.w, maxH / basePx.h));
    px = { w: Math.round(basePx.w * scale), h: Math.round(basePx.h * scale) };
  }
  if (opts.bleed) {
    const bleedPx = Math.round((BLEED_MM / 25.4) * PRINT_DPI);
    px = { w: px.w + 2 * bleedPx, h: px.h + 2 * bleedPx };
  }
  return px;
}

// Menor factor del slider con el que el upscale (que siempre parte del original
// de IA) ya llega a PRINT_DPI con el encuadre actual: por encima de él el
// archivo guardado no cambia. Sin tamaño de impresión no hay techo.
export function maxUsefulUpscale(
  info: EnhanceInfo | null,
  opts: { fitToFormat: boolean; crop?: PrintCrop },
): number {
  const printInches = info?.printInches;
  const sourcePx = info?.sourcePx;
  if (!printInches || !sourcePx) return MAX_UPSCALE_FACTOR;
  // El slider necesita max > min: como mínimo un paso por encima de 1.
  for (
    let factor = 1 + UPSCALE_STEP;
    factor < MAX_UPSCALE_FACTOR;
    factor += UPSCALE_STEP
  ) {
    const upscaled = {
      w: Math.round(sourcePx.width * factor),
      h: Math.round(sourcePx.height * factor),
    };
    const px = savedMasterPx(upscaled, printInches, { ...opts, bleed: false });
    if (dpiFor(px, printInches) >= PRINT_DPI) return factor;
  }
  return MAX_UPSCALE_FACTOR;
}

export interface PrintGeometry {
  printInches: Inches | null;
  cutInsetW: number;
  cutInsetH: number;
  safeInsetW: number;
  safeInsetH: number;
  stageAspect: string;
  // Máster que saldría de "Agrandar con IA" con el factor elegido.
  upscaleResultPx: Px | null;
  upscaleResultDpi: number | null;
  // DPI del máster que saldría al guardar ahora (sin volver a agrandar), con
  // el encuadre aplicado.
  framedDpi: number | null;
  // El upscale sube el DPI final (el encuadre no llega a PRINT_DPI y el factor
  // elegido lo acerca).
  upscaleUseful: boolean;
}

// Deriva la geometría de las guías y el resultado del upscale (todo
// client-side; el upscale real solo corre al pulsar "Agrandar con IA").
export function computePrintGeometry(
  info: EnhanceInfo | null,
  upscaleFactor: number,
  opts: { fitToFormat: boolean; bleed: boolean; crop?: PrintCrop },
): PrintGeometry {
  const printInches = info?.printInches ?? null;
  const sourcePx = info?.sourcePx
    ? { w: info.sourcePx.width, h: info.sourcePx.height }
    : null;

  let upscaleResultPx: Px | null = null;
  let upscaleResultDpi: number | null = null;
  let framedDpi: number | null = null;
  // Sin tamaño no hay DPI que comparar: el upscale queda disponible, como
  // antes de existir el cálculo.
  let upscaleUseful = printInches === null;
  if (sourcePx && printInches) {
    // "Guardar" parte de la base agrandada si existe; esa base se guardó
    // cubriendo el formato a PRINT_DPI.
    const basePx = info?.hasUpscaledBase
      ? savedMasterPx(
          { w: sourcePx.w * 100, h: sourcePx.h * 100 },
          printInches,
          { fitToFormat: false, bleed: false },
        )
      : sourcePx;
    framedDpi = Math.min(
      dpiFor(
        savedMasterPx(basePx, printInches, { ...opts, bleed: false }),
        printInches,
      ),
      PRINT_DPI,
    );

    const factor = Math.max(1, upscaleFactor);
    const upscaled = {
      w: Math.round(sourcePx.w * factor),
      h: Math.round(sourcePx.h * factor),
    };
    // El DPI se mide sin bleed: es la resolución dentro de la línea de corte.
    const unbled = savedMasterPx(upscaled, printInches, {
      ...opts,
      bleed: false,
    });
    upscaleResultPx = opts.bleed
      ? savedMasterPx(upscaled, printInches, opts)
      : unbled;
    upscaleResultDpi = Math.min(dpiFor(unbled, printInches), PRINT_DPI);
    upscaleUseful = framedDpi < PRINT_DPI && upscaleResultDpi > framedDpi;
  }

  // ── Print guide geometry ────────────────────────────────────────────────
  // Con bleed el contenedor incluye la sangre a cada lado; sin bleed el
  // contenedor es el formato y la línea de corte coincide con su borde.
  // Guide positions expressed as % of the container.
  const bleedMm = opts.bleed ? BLEED_MM : 0;
  const printMmW = printInches ? printInches.width * 25.4 : null;
  const printMmH = printInches ? printInches.height * 25.4 : null;
  const totalMmW = printMmW !== null ? printMmW + 2 * bleedMm : null;
  const totalMmH = printMmH !== null ? printMmH + 2 * bleedMm : null;

  const cutInsetW = totalMmW ? (bleedMm / totalMmW) * 100 : 0;
  const cutInsetH = totalMmH ? (bleedMm / totalMmH) * 100 : 0;
  const safeMm = bleedMm + SAFE_MARGIN_MM;
  const safeInsetW = totalMmW ? (safeMm / totalMmW) * 100 : 0;
  const safeInsetH = totalMmH ? (safeMm / totalMmH) * 100 : 0;

  const stageAspect =
    totalMmW && totalMmH ? `${totalMmW} / ${totalMmH}` : "1 / 1";

  return {
    printInches,
    cutInsetW,
    cutInsetH,
    safeInsetW,
    safeInsetH,
    stageAspect,
    upscaleResultPx,
    upscaleResultDpi,
    framedDpi,
    upscaleUseful,
  };
}
