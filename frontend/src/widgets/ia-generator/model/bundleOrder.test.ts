import { describe, expect, it } from "vitest";
import {
  addSlot,
  parseBundleOrder,
  removeSlot,
  withQuantity,
  type BundleSlot,
} from "./bundleOrder";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const slot = (id: string): BundleSlot => ({
  generationId: id,
  imageUrl: `https://img/${id}.png`,
  styleName: "Retrato Clásico",
  variantId: "gid://shopify/ProductVariant/1",
  petName: "Max",
});

describe("parseBundleOrder", () => {
  it("lee un pedido válido", () => {
    const raw = JSON.stringify({ quantity: 3, slots: [slot("a")], updatedAt: NOW });
    expect(parseBundleOrder(raw, NOW)).toEqual({
      quantity: 3,
      slots: [slot("a")],
      updatedAt: NOW,
    });
  });

  it("descarta lo vacío, lo corrupto y lo caducado", () => {
    expect(parseBundleOrder(null, NOW)).toBeNull();
    expect(parseBundleOrder("{no es json", NOW)).toBeNull();
    expect(parseBundleOrder(JSON.stringify({ quantity: 2 }), NOW)).toBeNull();
    const old = JSON.stringify({ quantity: 2, slots: [], updatedAt: NOW - 8 * DAY });
    expect(parseBundleOrder(old, NOW)).toBeNull();
  });

  it("ignora retratos mal formados y nunca deja la cantidad por debajo de lo apartado", () => {
    const raw = JSON.stringify({
      quantity: 1,
      slots: [slot("a"), { generationId: "b" }, slot("c")],
      updatedAt: NOW,
    });
    const order = parseBundleOrder(raw, NOW);
    expect(order?.slots.map((s) => s.generationId)).toEqual(["a", "c"]);
    expect(order?.quantity).toBe(3);
  });
});

describe("addSlot", () => {
  it("aparta el retrato y no lo duplica", () => {
    const one = addSlot(null, slot("a"), 2, NOW);
    expect(one).toEqual({ quantity: 2, slots: [slot("a")], updatedAt: NOW });
    expect(addSlot(one, slot("a"), 2, NOW).slots).toHaveLength(1);
  });

  it("sube la cantidad si los apartados más el actual no caben", () => {
    const two = addSlot(addSlot(null, slot("a"), 2, NOW), slot("b"), 2, NOW);
    expect(two.quantity).toBe(3);
  });
});

describe("removeSlot y withQuantity", () => {
  it("quitar un retrato no cambia la cantidad", () => {
    const order = addSlot(null, slot("a"), 3, NOW);
    expect(removeSlot(order, "a", NOW)).toEqual({ quantity: 3, slots: [], updatedAt: NOW });
  });

  it("la cantidad no baja de los apartados más el actual", () => {
    const order = addSlot(addSlot(null, slot("a"), 3, NOW), slot("b"), 3, NOW);
    expect(withQuantity(order, 1, NOW).quantity).toBe(3);
    expect(withQuantity(null, 2, NOW).quantity).toBe(2);
  });
});
