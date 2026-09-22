import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Turn your pet into AI art and paint it yourself";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f5efe6",
          color: "#263238",
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
            maxWidth: 700,
          }}
        >
          <div
            style={{
              color: "#148f83",
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            CLAW &amp; SOUL
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.05,
            }}
          >
            Turn your pet into art.
          </div>
          <div
            style={{
              color: "#526168",
              display: "flex",
              fontSize: 30,
              lineHeight: 1.3,
            }}
          >
            5 free AI artworks · Free printable PDF · Canvas available
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: "#148f83",
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
          <span>PHOTO</span>
          <span style={{ fontSize: 26, margin: "12px 0" }}>↓</span>
          <span>PAINT</span>
        </div>
      </div>
    ),
    size,
  );
}
