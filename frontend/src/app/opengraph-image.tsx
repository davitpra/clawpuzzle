import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "La foto de tu mascota convertida en un rompecabezas personalizado";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Colores de marca de `globals.css` (`--color-primary`, `--color-cream`). La
// imagen se genera en el edge y no ve las variables CSS, así que van a mano.
const PRIMARY = "#292c40";
const CREAM = "#f0eee9";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: CREAM,
          color: PRIMARY,
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 76px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 720,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            CLAWPUZZLE
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.05,
            }}
          >
            Una pieza de tu mejor amigo para tenerla contigo.
          </div>
          <div
            style={{
              color: "#5c5f73",
              display: "flex",
              fontSize: 30,
              lineHeight: 1.3,
            }}
          >
            Vista previa gratis · MDF de 3 mm · Envíos a todo Ecuador
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: PRIMARY,
            borderRadius: 999,
            color: "white",
            display: "flex",
            flexDirection: "column",
            fontSize: 34,
            fontWeight: 800,
            height: 260,
            justifyContent: "center",
            lineHeight: 1.1,
            textAlign: "center",
            width: 260,
          }}
        >
          <span>FOTO</span>
          <span style={{ fontSize: 26, margin: "12px 0" }}>↓</span>
          <span>PUZZLE</span>
        </div>
      </div>
    ),
    size,
  );
}
