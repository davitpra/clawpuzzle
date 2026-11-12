import { describe, expect, it } from "vitest";
import type { CartItem } from "@/context/CartContext";
import type { ShopifyProduct, ShopifyVariant } from "@/lib/shopify/types";
import {
  authEvent,
  checkoutEvent,
  generateArtEvent,
  selectThemeEvent,
  themeOf,
  viewContentEvent,
} from "./events";

const variant = (id: string, tema: string, amount = "30.00"): ShopifyVariant => ({
  id,
  title: tema,
  availableForSale: true,
  selectedOptions: [{ name: "Tema", value: tema }],
  price: { amount, currencyCode: "USD" },
  compareAtPrice: null,
  image: null,
});

const perro = variant("v-perro", "Perro");
const gato = variant("v-gato", "Gato", "32.50");
const product = { id: "p1", title: "Claw Puzzle" } as ShopifyProduct;

describe("themeOf", () => {
  it("Perro / Gato según la opción de la variante", () => {
    expect(themeOf(perro)).toBe("Perro");
    expect(themeOf(gato)).toBe("Gato");
  });
});

describe("viewContentEvent", () => {
  it("ViewContent con precio de la variante y view_item", () => {
    const e = viewContentEvent(product, perro);
    expect(e.meta).toEqual({
      name: "ViewContent",
      params: {
        content_ids: ["p1"],
        content_type: "product",
        content_name: "Claw Puzzle",
        value: 30,
        currency: "USD",
      },
    });
    expect(e.ga?.name).toBe("view_item");
    expect(e.ga?.params).toMatchObject({ value: 30, currency: "USD" });
  });
});

describe("selectThemeEvent", () => {
  it("SelectTheme es custom y lleva el tema", () => {
    const e = selectThemeEvent(product, gato);
    expect(e.meta).toEqual({ name: "SelectTheme", custom: true, params: { theme: "Gato" } });
    expect(e.ga?.name).toBe("select_item");
    expect(e.ga?.params).toMatchObject({
      items: [{ item_id: "v-gato", item_variant: "Gato", price: 32.5 }],
    });
  });
});

describe("authEvent", () => {
  it("cuenta nueva → CompleteRegistration + sign_up", () => {
    const e = authEvent(true);
    expect(e.meta?.name).toBe("CompleteRegistration");
    expect(e.ga).toEqual({ name: "sign_up", params: { method: "Google" } });
  });

  it("login de cuenta existente → solo login en GA4", () => {
    expect(authEvent(false)).toEqual({ ga: { name: "login", params: { method: "Google" } } });
  });
});

describe("generateArtEvent", () => {
  it("GenerateArt custom y generate_art con el estilo", () => {
    const e = generateArtEvent("g1", "Acuarela");
    expect(e.meta).toMatchObject({ name: "GenerateArt", custom: true });
    expect(e.ga).toEqual({
      name: "generate_art",
      params: { generation_id: "g1", style: "Acuarela" },
    });
  });
});

describe("checkoutEvent", () => {
  const item = (variantId: string, price: number, quantity: number): CartItem => ({
    id: variantId || "x",
    variantId,
    name: "Claw Puzzle",
    price,
    quantity,
    img: "",
  });

  it("suma price × quantity y descarta líneas sin variante", () => {
    const e = checkoutEvent([item("v1", 30, 2), item("v2", 10, 1), item("", 99, 1)]);
    expect(e.meta).toEqual({
      name: "InitiateCheckout",
      params: {
        value: 70,
        currency: "USD",
        num_items: 3,
        content_ids: ["v1", "v2"],
        content_type: "product",
      },
    });
    expect(e.ga?.name).toBe("begin_checkout");
    expect(e.ga?.params).toMatchObject({ value: 70, transport_type: "beacon" });
  });
});
