import type { CSSProperties } from "react";
import type { BleedMode } from "@/entities/admin/api";

// Escala con la que "Extender imagen" estira la franja junto al corte: a este
// factor la banda solo muestra el píxel del borde, como `extendWith: 'copy'`.
const EXTEND_SCALE = 200;
// En "Extender" el píxel se toma unos px dentro del corte: justo en la línea,
// el redondeo del navegador puede dejar el borde de la imagen medio píxel
// fuera y, estirado ×200, la banda sale con el fondo gris.
const EXTEND_SAMPLE_INSET_PX = 3;

type Piece = {
  // Rect de la pieza en % del contenedor.
  l: number;
  t: number;
  w: number;
  h: number;
  // Escala respecto a la línea de corte (negativa = refleja).
  sx: number;
  sy: number;
  // Punto fijo de la transformación, en % del contenedor.
  ox: number;
  oy: number;
};

// Imita en CSS el sangrado del backend con la propia imagen: cada banda (y
// cada esquina) repite la imagen reflejada respecto a la línea de corte;
// "mirror" la refleja tal cual y "extend" la estira hasta el píxel del borde.
// `imgStyle` posiciona la imagen en % del contenedor, igual que en la vista.
export function BleedFill({
  src,
  mode,
  cutInsetW,
  cutInsetH,
  imgStyle,
}: {
  src: string;
  mode: Exclude<BleedMode, "solid">;
  cutInsetW: number;
  cutInsetH: number;
  imgStyle: CSSProperties;
}) {
  const k = mode === "mirror" ? -1 : -EXTEND_SCALE;
  const inset = mode === "extend" ? EXTEND_SAMPLE_INSET_PX : 0;
  // Punto fijo desplazado hacia el interior de la imagen (el centro, 50 %).
  const origin = (pct: number) =>
    pct === 50 || inset === 0
      ? `${pct}%`
      : `calc(${pct}% ${pct < 50 ? "+" : "-"} ${inset}px)`;
  const cw = cutInsetW;
  const ch = cutInsetH;
  const midW = 100 - 2 * cw;
  const midH = 100 - 2 * ch;
  const pieces: Piece[] = [
    { l: cw, t: 0, w: midW, h: ch, sx: 1, sy: k, ox: 50, oy: ch },
    { l: cw, t: 100 - ch, w: midW, h: ch, sx: 1, sy: k, ox: 50, oy: 100 - ch },
    { l: 0, t: ch, w: cw, h: midH, sx: k, sy: 1, ox: cw, oy: 50 },
    { l: 100 - cw, t: ch, w: cw, h: midH, sx: k, sy: 1, ox: 100 - cw, oy: 50 },
    { l: 0, t: 0, w: cw, h: ch, sx: k, sy: k, ox: cw, oy: ch },
    { l: 100 - cw, t: 0, w: cw, h: ch, sx: k, sy: k, ox: 100 - cw, oy: ch },
    { l: 0, t: 100 - ch, w: cw, h: ch, sx: k, sy: k, ox: cw, oy: 100 - ch },
    {
      l: 100 - cw,
      t: 100 - ch,
      w: cw,
      h: ch,
      sx: k,
      sy: k,
      ox: 100 - cw,
      oy: 100 - ch,
    },
  ].filter((p) => p.w > 0 && p.h > 0);

  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: `${p.l}%`,
            top: `${p.t}%`,
            width: `${p.w}%`,
            height: `${p.h}%`,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {/* Lienzo del tamaño del contenedor, colocado para que sus
              coordenadas coincidan con las de la vista. */}
          <div
            style={{
              position: "absolute",
              left: `${(-p.l / p.w) * 100}%`,
              top: `${(-p.t / p.h) * 100}%`,
              width: `${(100 / p.w) * 100}%`,
              height: `${(100 / p.h) * 100}%`,
              transform: `scale(${p.sx}, ${p.sy})`,
              transformOrigin: `${origin(p.ox)} ${origin(p.oy)}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                maxWidth: "none",
                display: "block",
                ...imgStyle,
              }}
            />
          </div>
        </div>
      ))}
    </>
  );
}
