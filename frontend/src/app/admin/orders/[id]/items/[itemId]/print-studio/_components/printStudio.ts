// Constantes y geometría pura del estudio de impresión. Extraído de
// Print Studio para separar el cálculo (sin estado) de la UI.
import type { EnhanceInfo } from "@/entities/admin/api";

export const GOOD_DPI = 300;
export const LOW_DPI = 200;
// Resolution the backend caps the saved print master at (matches PRINT_DPI server-side).
export const PRINT_DPI = 300;
export const DEFAULT_UPSCALE_FACTOR = 2;
// Sangre fija por lado; coincide con BLEED_MM del backend.
export const BLEED_MM = 3;
// Margen de seguridad dentro de la línea de corte.
const SAFE_MARGIN_MM = 10;

export function dpiTone(
  dpi: number | null,
): "success" | "warning" | "critical" {
  if (dpi === null || dpi < LOW_DPI) return "critical";
  if (dpi < GOOD_DPI) return "warning";
  return "success";
}

export interface PrintGeometry {
  printInches: { width: number; height: number } | null;
  cutInsetW: number;
  cutInsetH: number;
  safeInsetW: number;
  safeInsetH: number;
  stageAspect: string;
  targetPx: { w: number; h: number } | null;
  theoreticalDpi: number | null;
}

// Deriva la geometría de las guías de impresión y el tamaño/DPI teórico tras el
// upscale (todo client-side; el upscale real solo corre al guardar).
export function computePrintGeometry(
  info: EnhanceInfo | null,
  upscaleFactor: number,
): PrintGeometry {
  const printInches = info?.printInches ?? null;

  // Theoretical target pixel size and DPI after upscale. The backend caps the
  // saved master at PRINT_DPI, so we cap the displayed values too — otherwise a
  // high factor would falsely promise e.g. 600 DPI when the result will be 300.
  const rawTargetPx =
    info?.sourcePx && upscaleFactor > 1
      ? {
          w: Math.round(info.sourcePx.width * upscaleFactor),
          h: Math.round(info.sourcePx.height * upscaleFactor),
        }
      : info?.sourcePx
        ? { w: info.sourcePx.width, h: info.sourcePx.height }
        : null;
  const rawDpi =
    rawTargetPx && printInches
      ? Math.floor(
          Math.min(
            rawTargetPx.w / printInches.width,
            rawTargetPx.h / printInches.height,
          ),
        )
      : null;
  // When the raw upscale would exceed PRINT_DPI, the backend downscales to it.
  const capScale =
    rawDpi !== null && rawDpi > PRINT_DPI ? PRINT_DPI / rawDpi : 1;
  const targetPx = rawTargetPx
    ? {
        w: Math.round(rawTargetPx.w * capScale),
        h: Math.round(rawTargetPx.h * capScale),
      }
    : null;
  const theoreticalDpi = rawDpi !== null ? Math.min(rawDpi, PRINT_DPI) : null;

  // ── Print guide geometry ────────────────────────────────────────────────
  // The stage container always includes the bleed on each side.
  // Total size in mm = printMm + 2·bleed; guide positions expressed as % of total.
  const printMmW = printInches ? printInches.width * 25.4 : null;
  const printMmH = printInches ? printInches.height * 25.4 : null;
  const totalMmW = printMmW !== null ? printMmW + 2 * BLEED_MM : null;
  const totalMmH = printMmH !== null ? printMmH + 2 * BLEED_MM : null;

  // Cut line = bleed from the outer edge
  const cutInsetW = totalMmW ? (BLEED_MM / totalMmW) * 100 : 0;
  const cutInsetH = totalMmH ? (BLEED_MM / totalMmH) * 100 : 0;
  // Safe zone = bleed + safety margin from the outer edge
  const safeMm = BLEED_MM + SAFE_MARGIN_MM;
  const safeInsetW = totalMmW ? (safeMm / totalMmW) * 100 : 0;
  const safeInsetH = totalMmH ? (safeMm / totalMmH) * 100 : 0;

  // Stage aspect ratio: total including bleed
  const stageAspect =
    totalMmW && totalMmH
      ? `${totalMmW} / ${totalMmH}`
      : printInches
        ? `${printInches.width} / ${printInches.height}`
        : "1 / 1";

  return {
    printInches,
    cutInsetW,
    cutInsetH,
    safeInsetW,
    safeInsetH,
    stageAspect,
    targetPx,
    theoreticalDpi,
  };
}
