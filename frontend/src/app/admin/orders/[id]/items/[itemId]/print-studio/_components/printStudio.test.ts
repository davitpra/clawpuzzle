import { describe, expect, it } from "vitest";
import type { EnhanceInfo } from "@/entities/admin/api";
import {
  clampCrop,
  computeAspectCrop,
  cropRect,
  computePrintGeometry,
  formatPrintSize,
  maxUsefulUpscale,
  savedMasterPx,
} from "./printStudio";

// 20 × 30 cm, el tamaño del producto de lanzamiento.
const print = { width: 20 / 2.54, height: 30 / 2.54 };

function info(width: number, height: number): EnhanceInfo {
  return {
    sourcePx: { width, height },
    printInches: print,
  } as EnhanceInfo;
}

describe("formatPrintSize", () => {
  it("shows the size in rounded centimetres", () => {
    expect(formatPrintSize(print)).toBe("20 × 30 cm");
    expect(formatPrintSize({ width: 21.5 / 2.54, height: 30 / 2.54 })).toBe(
      "21,5 × 30 cm",
    );
  });
});

describe("computeAspectCrop", () => {
  it("crops the sides of a 3:4 image on a 2:3 format", () => {
    const crop = computeAspectCrop({ w: 3584, h: 4800 }, print);
    expect(crop?.axis).toBe("w");
    expect(crop?.perSide).toBeCloseTo((1 - 2 / 3 / 0.7467) / 2, 3);
  });

  it("ignores pixel rounding", () => {
    expect(computeAspectCrop({ w: 2362, h: 3543 }, print)).toBeNull();
  });
});

describe("savedMasterPx", () => {
  // Mismo cálculo que buildPrintImage en el backend.
  it("caps at 300 DPI covering the format", () => {
    expect(
      savedMasterPx({ w: 3584, h: 4800 }, print, {
        fitToFormat: false,
        bleed: false,
      }),
    ).toEqual({ w: 2645, h: 3543 });
  });

  it("crops to the exact format with fitToFormat", () => {
    expect(
      savedMasterPx({ w: 3584, h: 4800 }, print, {
        fitToFormat: true,
        bleed: false,
      }),
    ).toEqual({ w: 2362, h: 3543 });
  });

  it("never enlarges and adds the bleed", () => {
    expect(
      savedMasterPx({ w: 896, h: 1344 }, print, {
        fitToFormat: true,
        bleed: true,
      }),
    ).toEqual({ w: 896 + 70, h: 1344 + 70 });
  });
});

describe("computePrintGeometry", () => {
  const opts = { fitToFormat: true, bleed: false };

  it("puts the cut line on the edge without bleed", () => {
    const g = computePrintGeometry(info(3584, 4800), 1, opts);
    expect(g.cutInsetW).toBe(0);
    const [w, h] = g.stageAspect.split("/").map(Number);
    expect(w / h).toBeCloseTo(2 / 3, 5);
  });

  it("reserves the bleed around the format when enabled", () => {
    const g = computePrintGeometry(info(3584, 4800), 1, {
      ...opts,
      bleed: true,
    });
    expect(g.cutInsetW).toBeCloseTo((3 / 206) * 100, 5);
  });

  it("does not offer an upscale when the source already reaches 300 DPI", () => {
    const g = computePrintGeometry(info(3584, 4800), 2, opts);
    expect(g.upscaleUseful).toBe(false);
    expect(g.upscaleResultDpi).toBe(300);
  });

  it("offers an upscale for a low-resolution source", () => {
    const g = computePrintGeometry(info(832, 1248), 4, opts);
    expect(g.upscaleUseful).toBe(true);
    expect(g.upscaleResultPx).toEqual({ w: 2362, h: 3543 });
    expect(g.upscaleResultDpi).toBe(300);
  });
});

describe("cropRect", () => {
  const img = { w: 3584, h: 4800 };

  it("matches the backend rect at zoom 1, centered", () => {
    const rect = cropRect(img, print);
    expect(rect.width * img.w).toBeCloseTo(3200, 0);
    expect(rect.left * img.w).toBeCloseTo(192, 0);
    expect(rect.height).toBe(1);
  });

  it("keeps the rect inside the image", () => {
    expect(cropRect(img, print, { x: 0, y: 0.5, zoom: 1 }).left).toBe(0);
    const right = cropRect(img, print, { x: 1, y: 0.5, zoom: 1 });
    expect(right.left + right.width).toBeCloseTo(1, 10);
  });

  it("clampCrop pulls the centre back from the edge", () => {
    const crop = clampCrop({ x: 0, y: 0.5, zoom: 1 }, img, print);
    expect(crop.x).toBeCloseTo(3200 / 3584 / 2, 5);
    expect(clampCrop({ x: 0.5, y: 0.5, zoom: 9 }, img, print).zoom).toBe(3);
  });

  it("zooming in lowers the saved resolution", () => {
    expect(
      savedMasterPx(img, print, {
        fitToFormat: true,
        bleed: false,
        crop: { x: 0.5, y: 0.5, zoom: 2 },
      }),
    ).toEqual({ w: 1600, h: 2400 });
  });

  it("keeps the upscale available without a print size", () => {
    const g = computePrintGeometry(
      {
        sourcePx: { width: 832, height: 1248 },
        printInches: null,
      } as EnhanceInfo,
      2,
      { fitToFormat: false, bleed: false },
    );
    expect(g.upscaleUseful).toBe(true);
    expect(g.upscaleResultDpi).toBeNull();
  });
});

describe("maxUsefulUpscale", () => {
  const opts = { fitToFormat: true };

  it("stops at the first step that reaches 300 DPI", () => {
    // 832 px × 3 = 2496 ≥ 2362 px que pide el ancho de 20 cm a 300 DPI.
    expect(maxUsefulUpscale(info(832, 1248), opts)).toBe(3);
  });

  it("needs a larger factor when the crop zooms in", () => {
    expect(
      maxUsefulUpscale(info(832, 1248), {
        ...opts,
        crop: { x: 0.5, y: 0.5, zoom: 2 },
      }),
    ).toBe(6);
  });

  it("keeps one step above 1 when the source is already enough", () => {
    expect(maxUsefulUpscale(info(3584, 4800), opts)).toBe(1.5);
  });

  it("has no ceiling without a print size", () => {
    expect(
      maxUsefulUpscale(
        {
          sourcePx: { width: 832, height: 1248 },
          printInches: null,
        } as EnhanceInfo,
        opts,
      ),
    ).toBe(8);
  });
});
