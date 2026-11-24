import { describe, expect, it } from "vitest";
import {
  addPiece,
  createBundleOrder,
  dropPendingPieces,
  emptyPiece,
  hasProgress,
  nextBundleStep,
  parseBundleOrder,
  removePiece,
  updatePiece,
  type BundleOrder,
  type BundlePiece,
} from "./bundleOrder";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const CAT = "gid://shopify/ProductVariant/1";
const DOG = "gid://shopify/ProductVariant/2";

const done = (id: string, variantId = CAT): BundlePiece => ({
  styleId: `style-${id}`,
  styleName: "Retrato Clásico",
  styleImg: null,
  variantId,
  petName: "Max",
  generationId: id,
  payload: {
    petId: "pet-1",
    petPhotoId: "photo-1",
    formatId: "f",
    productRefId: "p",
    styleId: `style-${id}`,
  },
  imageUrl: `https://img/${id}.png`,
});

const styled = (variantId = CAT): BundlePiece => ({
  ...emptyPiece(variantId),
  styleId: "style-x",
});

const order = (...pieces: BundlePiece[]): BundleOrder => ({
  pieces,
  updatedAt: NOW,
});

describe("createBundleOrder", () => {
  it("crea una pieza vacía por rompecabezas, con el tema de la landing", () => {
    const o = createBundleOrder(3, DOG, NOW);
    expect(o.pieces).toHaveLength(3);
    expect(o.pieces.every((p) => p.variantId === DOG && !p.styleId)).toBe(true);
  });

  it("al subir desde la vista previa, el retrato existente es la pieza 1", () => {
    const o = createBundleOrder(2, DOG, NOW, done("g1", CAT));
    expect(o.pieces[0].generationId).toBe("g1");
    // La pieza nueva hereda el tema del retrato que ya existe.
    expect(o.pieces[1]).toEqual(emptyPiece(CAT));
  });

  it("topa entre 1 y 3", () => {
    expect(createBundleOrder(5, CAT, NOW).pieces).toHaveLength(3);
    expect(createBundleOrder(0, CAT, NOW).pieces).toHaveLength(1);
  });
});

describe("nextBundleStep", () => {
  it("empieza por el estilo del 1", () => {
    expect(nextBundleStep(createBundleOrder(3, CAT, NOW))).toEqual({
      kind: "style",
      index: 0,
    });
  });

  it("con su estilo elegido, la foto de esa misma pieza", () => {
    expect(nextBundleStep(order(styled(), emptyPiece(CAT), emptyPiece(CAT)))).toEqual({
      kind: "photo",
      index: 0,
    });
  });

  it("enviada la foto del 1, el estilo del 2", () => {
    expect(nextBundleStep(order(done("g1"), emptyPiece(CAT), emptyPiece(CAT)))).toEqual({
      kind: "style",
      index: 1,
    });
  });

  it("con todas generadas (listas o no), la galería", () => {
    expect(nextBundleStep(order(done("g1"), done("g2")))).toEqual({ kind: "review" });
  });

  it("\"Cambiar estilo\" en la foto vuelve al estilo de esa pieza", () => {
    const o = updatePiece(order(done("g1"), styled()), 1, { styleId: null }, NOW);
    expect(nextBundleStep(o)).toEqual({ kind: "style", index: 1 });
  });
});

describe("hasProgress", () => {
  it("solo cuenta desde el primer estilo elegido", () => {
    expect(hasProgress(null)).toBe(false);
    expect(hasProgress(createBundleOrder(2, CAT, NOW))).toBe(false);
    expect(hasProgress(order(styled(), emptyPiece(CAT)))).toBe(true);
  });
});

describe("addPiece / removePiece", () => {
  it("agrega con el tema de la última pieza, hasta 3", () => {
    const o = addPiece(order(done("g1", DOG)), NOW);
    expect(o.pieces[1]).toEqual(emptyPiece(DOG));
    const full = order(done("a"), done("b"), done("c"));
    expect(addPiece(full, NOW)).toBe(full);
  });

  it("quita cualquiera menos la última que queda", () => {
    expect(removePiece(order(done("a"), done("b")), 0, NOW).pieces.map((p) => p.generationId)).toEqual(["b"]);
    const one = order(done("a"));
    expect(removePiece(one, 0, NOW)).toBe(one);
  });
});

describe("dropPendingPieces", () => {
  it("quita desde el final solo las que no tienen generación", () => {
    const o = dropPendingPieces(order(done("a"), styled(), styled()), 1, NOW);
    expect(o.pieces).toHaveLength(2);
    expect(o.pieces[0].generationId).toBe("a");
  });

  it("nunca deja el pedido vacío", () => {
    expect(dropPendingPieces(order(styled(), styled()), 5, NOW).pieces).toHaveLength(1);
  });
});

describe("parseBundleOrder", () => {
  it("lee un pedido guardado", () => {
    const o = order(done("a"), styled());
    expect(parseBundleOrder(JSON.stringify(o), NOW + DAY)).toEqual(o);
  });

  it("caduca a los 7 días", () => {
    const raw = JSON.stringify(order(done("a")));
    expect(parseBundleOrder(raw, NOW + 8 * DAY)).toBeNull();
  });

  it("descarta lo corrupto", () => {
    expect(parseBundleOrder(null, NOW)).toBeNull();
    expect(parseBundleOrder("{", NOW)).toBeNull();
    expect(parseBundleOrder(JSON.stringify({ updatedAt: NOW, pieces: [] }), NOW)).toBeNull();
    // Formato anterior (retratos apartados): no se retoma.
    expect(parseBundleOrder(JSON.stringify({ updatedAt: NOW, quantity: 2, slots: [] }), NOW)).toBeNull();
  });

  it("sin generación no conserva payload ni imagen", () => {
    const raw = JSON.stringify(
      order({ ...styled(), payload: done("a").payload, imageUrl: "https://x" }),
    );
    const piece = parseBundleOrder(raw, NOW)!.pieces[0];
    expect(piece.payload).toBeNull();
    expect(piece.imageUrl).toBeNull();
  });
});
