import { describe, expect, it } from "vitest";
import type { CartItem } from "@/context/CartContext";
import { buildCheckoutLines } from "./checkoutLines";

// Contrato con el webhook de órdenes del backend (`ingestLineItem`): los
// nombres de estos attributes son los que lee para vincular arte y cuenta.
const DOG_VARIANT = "gid://shopify/ProductVariant/111";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "gen-1",
    variantId: DOG_VARIANT,
    name: "Puzzle",
    size: "4:3",
    style: "Acuarela",
    price: 39.9,
    quantity: 1,
    img: "https://cdn.test/puzzle.png",
    generationId: "gen-1",
    imageUrl: "https://cdn.test/art.png",
    ...overrides,
  };
}

const attrs = (line: { attributes: { key: string; value: string }[] }) =>
  Object.fromEntries(line.attributes.map((a) => [a.key, a.value]));

describe("buildCheckoutLines", () => {
  it("la línea lleva la variante elegida y los attributes que lee el webhook", () => {
    const [line] = buildCheckoutLines([item()], "user-1");

    expect(line.merchandiseId).toBe(DOG_VARIANT);
    expect(line.quantity).toBe(1);
    expect(attrs(line)).toEqual({
      Style: "Acuarela",
      Size: "4:3",
      _user_id: "user-1",
      _generation_id: "gen-1",
      _image_url: "https://cdn.test/art.png",
    });
  });

  it("los ids internos van con prefijo _ (Shopify los oculta al cliente)", () => {
    const [line] = buildCheckoutLines([item()], "user-1");
    const keys = line.attributes.map((a) => a.key);

    expect(keys).not.toContain("generation_id");
    expect(keys).not.toContain("image_url");
    expect(keys).not.toContain("user_id");
  });

  it("sin sesión no manda _user_id", () => {
    const [line] = buildCheckoutLines([item()], null);
    expect(attrs(line)).not.toHaveProperty("_user_id");
  });

  it("_image_url solo acompaña a una generación", () => {
    const [line] = buildCheckoutLines(
      [item({ generationId: undefined })],
      "user-1",
    );
    expect(attrs(line)).not.toHaveProperty("_generation_id");
    expect(attrs(line)).not.toHaveProperty("_image_url");
  });

  it("descarta las líneas sin variante de Shopify", () => {
    const lines = buildCheckoutLines(
      [item({ variantId: "" }), item({ id: "gen-2", generationId: "gen-2" })],
      "user-1",
    );
    expect(lines).toHaveLength(1);
    expect(attrs(lines[0])._generation_id).toBe("gen-2");
  });
});
