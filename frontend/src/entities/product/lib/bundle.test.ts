import { describe, expect, it } from "vitest";
import {
  bundlePrice,
  bundleUnitDiscount,
  nextBundleCost,
  parseBundleQuantity,
} from "./bundle";

describe("bundlePrice", () => {
  it("1 rompecabezas no lleva descuento", () => {
    expect(bundlePrice(69.99, 1)).toEqual({
      unitPrice: 69.99,
      total: 69.99,
      regularTotal: 69.99,
      savings: 0,
    });
  });

  // Totales verificados contra carritos reales de Shopify (2026-11-24).
  it("2 rompecabezas cuestan $119,98 ($59,99 c/u)", () => {
    expect(bundlePrice(69.99, 2)).toEqual({
      unitPrice: 59.99,
      total: 119.98,
      regularTotal: 139.98,
      savings: 20,
    });
  });

  it("3 rompecabezas cuestan $149,97 ($49,99 c/u)", () => {
    expect(bundlePrice(69.99, 3)).toEqual({
      unitPrice: 49.99,
      total: 149.97,
      regularTotal: 209.97,
      savings: 60,
    });
  });

  it("de 4 en adelante se queda el tramo de 3, como en Shopify", () => {
    expect(bundleUnitDiscount(4)).toBe(20);
    expect(bundlePrice(69.99, 4).total).toBe(199.96);
  });
});

describe("parseBundleQuantity", () => {
  it("acepta 1, 2 y 3", () => {
    expect(parseBundleQuantity("1")).toBe(1);
    expect(parseBundleQuantity("2")).toBe(2);
    expect(parseBundleQuantity("3")).toBe(3);
  });

  it("cualquier otro valor cae a 1", () => {
    expect(parseBundleQuantity(null)).toBe(1);
    expect(parseBundleQuantity("")).toBe(1);
    expect(parseBundleQuantity("4")).toBe(1);
    expect(parseBundleQuantity("2.5")).toBe(1);
    expect(parseBundleQuantity("abc")).toBe(1);
  });
});

describe("nextBundleCost", () => {
  it("es la diferencia exacta de totales", () => {
    expect(nextBundleCost(69.99, 1)).toBe(49.99);
    expect(nextBundleCost(69.99, 2)).toBe(29.99);
  });

  it("en el tope no hay siguiente", () => {
    expect(nextBundleCost(69.99, 3)).toBe(0);
  });
});
