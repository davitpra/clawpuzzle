import { describe, expect, it } from "vitest";
import type { FormatOption } from "@/hooks/useFormatOptions";
import { pickOfferVariant } from "./offerVariant";

const DOG = "gid://shopify/ProductVariant/111";
const CAT = "gid://shopify/ProductVariant/222";

function format(
  shopifyVariantId: string,
  overrides: Partial<FormatOption> = {},
): FormatOption {
  return {
    formatId: "ratio_4_3",
    name: "ratio_4_3",
    displayName: "4:3",
    aspectRatio: "4:3",
    width: 1184,
    height: 888,
    shopifyVariantId,
    price: "39.90",
    currencyCode: "USD",
    availableForSale: true,
    ...overrides,
  };
}

// Shopify devuelve Perro primero: el riesgo es vender Perro a quien eligió Gato.
const formats = [format(DOG), format(CAT)];

describe("pickOfferVariant", () => {
  it("vende la variante que llegó desde la ficha (Gato), no la primera", () => {
    expect(pickOfferVariant(formats, "ratio_4_3", CAT)?.shopifyVariantId).toBe(
      CAT,
    );
    expect(pickOfferVariant(formats, "ratio_4_3", DOG)?.shopifyVariantId).toBe(
      DOG,
    );
  });

  it("sin variante pedida, la primera disponible del formato", () => {
    expect(pickOfferVariant(formats, "ratio_4_3", null)?.shopifyVariantId).toBe(
      DOG,
    );
  });

  it("si la pedida está agotada, cae a otra disponible del formato", () => {
    const soldOutCat = [format(DOG), format(CAT, { availableForSale: false })];
    expect(
      pickOfferVariant(soldOutCat, "ratio_4_3", CAT)?.shopifyVariantId,
    ).toBe(DOG);
  });

  it("ignora variantes de otro formato", () => {
    const mixed = [format(DOG, { formatId: "a3_portrait" }), format(CAT)];
    expect(pickOfferVariant(mixed, "ratio_4_3", DOG)?.shopifyVariantId).toBe(
      CAT,
    );
  });

  it("sin nada disponible no hay oferta", () => {
    const soldOut = formats.map((f) => ({ ...f, availableForSale: false }));
    expect(pickOfferVariant(soldOut, "ratio_4_3", DOG)).toBeNull();
  });
});
