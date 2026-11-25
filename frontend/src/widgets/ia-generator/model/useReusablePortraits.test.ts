import { describe, expect, it } from "vitest";
import { toReusablePortrait } from "./useReusablePortraits";

const base = {
  id: "g1",
  status: "completed",
  type: "image",
  resultUrl: "https://img/g1.png",
  thumbnailUrl: "https://img/g1-thumb.png",
  createdAt: "2026-11-24T00:00:00Z",
  errorMessage: null,
  isFavorite: false,
  isPublic: false,
  completedAt: null,
  formatId: "f1",
  productRefId: "p1",
  productRef: null,
  pet: { id: "pet1", name: "Rocky" },
  style: { id: "s1", displayName: "Klimt" },
  petId: "pet1",
  petPhotoId: "photo1",
  styleId: "s1",
};

describe("toReusablePortrait", () => {
  it("trae lo necesario para pedirlo y regenerarlo", () => {
    expect(toReusablePortrait(base)).toEqual({
      generationId: "g1",
      imageUrl: "https://img/g1.png",
      thumbnailUrl: "https://img/g1-thumb.png",
      styleId: "s1",
      styleName: "Klimt",
      petName: "Rocky",
      payload: {
        petId: "pet1",
        petPhotoId: "photo1",
        formatId: "f1",
        productRefId: "p1",
        styleId: "s1",
      },
    });
  });

  it("sin foto guardada se puede pedir pero no regenerar", () => {
    expect(toReusablePortrait({ ...base, petPhotoId: null })?.payload).toBeNull();
  });

  it("descarta lo que no está listo", () => {
    expect(toReusablePortrait({ ...base, status: "failed" })).toBeNull();
    expect(toReusablePortrait({ ...base, resultUrl: null })).toBeNull();
  });

  it("sin miniatura usa la imagen completa", () => {
    expect(toReusablePortrait({ ...base, thumbnailUrl: null })?.thumbnailUrl).toBe(
      "https://img/g1.png",
    );
  });
});
