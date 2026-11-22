import { describe, expect, it } from "vitest";
import { mapReviews, parseRating, pickVideoSource } from "./mapReviews";

const image = (id: string) => ({
  __typename: "MediaImage",
  id,
  alt: "",
  image: { url: `https://cdn.shopify.com/${id}.jpg`, width: 800, height: 1200 },
});

const video = {
  __typename: "Video",
  id: "v1",
  alt: "Luna armando su rompecabezas",
  previewImage: { url: "https://cdn.shopify.com/v1.jpg", width: 1080, height: 1920 },
  sources: [
    { url: "hls.m3u8", mimeType: "application/x-mpegURL", width: 2160, height: 3840 },
    { url: "480.mp4", mimeType: "video/mp4", width: 480, height: 854 },
    { url: "1080.mp4", mimeType: "video/mp4", width: 1080, height: 1920 },
    { url: "4k.mp4", mimeType: "video/mp4", width: 2160, height: 3840 },
  ],
};

describe("pickVideoSource", () => {
  it("elige el mp4 más grande que no pase de 1080 en su lado corto", () => {
    expect(pickVideoSource(video.sources)?.url).toBe("1080.mp4");
  });

  it("si todos los mp4 pasan el límite, se queda con el más chico", () => {
    const big = [
      { url: "4k.mp4", mimeType: "video/mp4", width: 2160, height: 3840 },
      { url: "1440.mp4", mimeType: "video/mp4", width: 1440, height: 2560 },
    ];
    expect(pickVideoSource(big)?.url).toBe("1440.mp4");
  });

  it("sin mp4 no hay fuente", () => {
    expect(pickVideoSource([video.sources[0]])).toBeNull();
  });
});

describe("mapReviews", () => {
  it("mapea una reseña con su foto y sus textos", () => {
    const [review] = mapReviews([
      {
        id: "r1",
        body: { value: "Hasta el gato lo aprobó." },
        author: { value: "Daniela S." },
        city: { value: "Ambato" },
        raiting: { value: '{"scale_min":"1.0","scale_max":"5.0","value":"4.0"}' },
        media: { reference: image("a"), references: null },
      },
    ]);
    expect(review).toMatchObject({
      id: "r1",
      body: "Hasta el gato lo aprobó.",
      author: "Daniela S.",
      city: "Ambato",
      rating: 4,
      media: { kind: "image", url: "https://cdn.shopify.com/a.jpg" },
    });
  });

  it("sin alt en Shopify, el alt nombra al autor", () => {
    const [review] = mapReviews([
      { id: "r1", author: { value: "Vale" }, media: { reference: image("a") } },
    ]);
    expect(review.media.alt).toBe("Foto de Vale con el rompecabezas de su mascota");
  });

  it("quita las comillas que el cliente haya escrito en la frase", () => {
    const [review] = mapReviews([
      { id: "r1", body: { value: "“Me encantó”" }, media: { reference: image("a") } },
    ]);
    expect(review.body).toBe("Me encantó");
  });

  it("los textos vacíos o ausentes llegan como null", () => {
    const [review] = mapReviews([
      { id: "r1", body: { value: "  " }, author: null, media: { reference: image("a") } },
    ]);
    expect(review).toMatchObject({ body: null, author: null, city: null, rating: null });
  });

  it("con un campo de lista toma el primer archivo válido", () => {
    const [review] = mapReviews([
      {
        id: "r1",
        media: {
          references: {
            nodes: [{ __typename: "MediaImage", id: "p", image: null }, video],
          },
        },
      },
    ]);
    expect(review.media).toMatchObject({
      kind: "video",
      url: "1080.mp4",
      poster: { url: "https://cdn.shopify.com/v1.jpg" },
    });
  });

  it("descarta las entradas sin foto ni video", () => {
    const reviews = mapReviews([
      { id: "r1", media: null },
      { id: "r2", media: { reference: { __typename: "GenericFile", id: "pdf" } } },
      { id: "r3", media: { reference: image("ok") } },
    ]);
    expect(reviews.map((r) => r.id)).toEqual(["r3"]);
  });
});

describe("parseRating", () => {
  it("lee el JSON de Shopify en escala de 5", () => {
    expect(parseRating('{"scale_min":"1.0","scale_max":"5.0","value":"5.0"}')).toBe(5);
  });

  it("lleva otras escalas a 5 y acota el resultado", () => {
    expect(parseRating('{"scale_min":"0","scale_max":"10","value":"8"}')).toBe(4);
    expect(parseRating('{"scale_max":"5","value":"9"}')).toBe(5);
  });

  it("un valor ausente o ilegible no tiene calificación", () => {
    expect(parseRating(null)).toBeNull();
    expect(parseRating("no es json")).toBeNull();
    expect(parseRating('{"value":"abc"}')).toBeNull();
  });
});
