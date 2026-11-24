import { describe, expect, it } from "vitest";
import { bundlePrice, bundleUnitDiscount, parseBundleQuantity } from "./bundle";

describe("bundlePrice", () => {
  it("1 rompecabezas no lleva descuento", () => {
    expect(bundlePrice(69.99, 1)).toEqual({
      unitPrice: 69.99,
      total: 69.99,
      regularTotal: 69.99,
      savings: 0,
    });
  });

  it("2 rompecabezas cuestan $120 ($60 c/u)", () => {
    expect(bundlePrice(69.99, 2)).toEqual({
      unitPrice: 60,
      total: 120,
      regularTotal: 139.98,
      savings: 19.98,
    });
  });

  it("3 rompecabezas cuestan $150 ($50 c/u)", () => {
    expect(bundlePrice(69.99, 3)).toEqual({
      unitPrice: 50,
      total: 150,
      regularTotal: 209.97,
      savings: 59.97,
    });
  });

  it("de 4 en adelante se queda el tramo de 3, como en Shopify", () => {
    expect(bundleUnitDiscount(4)).toBe(19.99);
    expect(bundlePrice(69.99, 4).total).toBe(200);
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
