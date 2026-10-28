import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BlockStack,
  Button,
  ColorPicker,
  Popover,
  Text,
} from "@shopify/polaris";
import type { BleedMode } from "@/entities/admin/api";
import type { HsbColor } from "@/lib/colorUtils";
import { BleedFill } from "./BleedFill";

const MODES: { mode: BleedMode; label: string }[] = [
  { mode: "extend", label: "Extender imagen (recomendado)" },
  { mode: "mirror", label: "Reflejar bordes" },
  { mode: "solid", label: "Color sólido" },
];

// Sangrado de la miniatura, exagerado para que el efecto se vea a ese tamaño.
const THUMB_INSET_W = 22;
const THUMB_H = 56;

// Miniatura de un modo de imagen: la imagen al centro y los lados rellenos
// como quedaría el sangrado.
function ImageThumb({
  src,
  mode,
}: {
  src: string | null;
  mode: Exclude<BleedMode, "solid">;
}) {
  const imgStyle = {
    left: `${THUMB_INSET_W}%`,
    top: 0,
    width: `${100 - 2 * THUMB_INSET_W}%`,
    height: "100%",
    objectFit: "cover" as const,
  };
  return (
    <div
      style={{
        position: "relative",
        height: THUMB_H,
        borderRadius: 4,
        overflow: "hidden",
        background: "var(--p-color-bg-surface-secondary)",
      }}
    >
      {src && (
        <>
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
          <BleedFill
            src={src}
            mode={mode}
            cutInsetW={THUMB_INSET_W}
            cutInsetH={0}
            imgStyle={imgStyle}
          />
        </>
      )}
    </div>
  );
}

// Selector del relleno del sangrado: tres tarjetas en fila que funcionan como
// un grupo de radio (flechas para moverse, como un radio nativo).
export function BleedModePicker({
  value,
  onChange,
  thumbUrl,
  bleedHsb,
  bleedColor,
  onBleedColorChange,
}: {
  value: BleedMode;
  onChange: (mode: BleedMode) => void;
  thumbUrl: string | null;
  bleedHsb: HsbColor;
  bleedColor: string;
  onBleedColorChange: (hsb: HsbColor) => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  function select(index: number) {
    const next = (index + MODES.length) % MODES.length;
    onChange(MODES[next].mode);
    refs.current[next]?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(index - 1);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(MODES[index].mode);
    }
  }

  return (
    <BlockStack gap="200">
      <Text as="span" variant="bodySm" id="bleed-mode-label">
        Método de relleno del sangrado
      </Text>
      <div
        role="radiogroup"
        aria-labelledby="bleed-mode-label"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {MODES.map(({ mode, label }, i) => {
          const selected = value === mode;
          let thumb: ReactNode;
          if (mode === "solid") {
            thumb = (
              <div
                aria-hidden
                style={{
                  height: THUMB_H,
                  borderRadius: 4,
                  border: "1px solid var(--p-color-border)",
                  background: bleedColor,
                }}
              />
            );
          } else {
            thumb = <ImageThumb src={thumbUrl} mode={mode} />;
          }
          return (
            <div
              key={mode}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(mode)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              style={{
                cursor: "pointer",
                padding: 8,
                borderRadius: 8,
                border: selected
                  ? "2px solid var(--p-color-border-emphasis)"
                  : "1px solid var(--p-color-border)",
                // El borde de 2 px no debe mover el contenido.
                margin: selected ? 0 : 1,
                background: selected
                  ? "var(--p-color-bg-surface-selected)"
                  : "var(--p-color-bg-surface)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 0,
              }}
            >
              {thumb}
              {mode === "solid" ? (
                // El hex abre el selector de color sin cambiar de tarjeta dos veces.
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                    columnGap: 6,
                  }}
                >
                  <Text as="span" variant="bodySm">
                    {label}
                  </Text>
                  <Popover
                    active={colorOpen}
                    onClose={() => setColorOpen(false)}
                    activator={
                      <Button
                        variant="plain"
                        size="slim"
                        disclosure={colorOpen ? "up" : "down"}
                        onClick={() => {
                          onChange("solid");
                          setColorOpen((open) => !open);
                        }}
                        accessibilityLabel={`Color sólido ${bleedColor}, cambiar color`}
                      >
                        {bleedColor}
                      </Button>
                    }
                  >
                    <div style={{ padding: 12 }}>
                      <ColorPicker
                        color={bleedHsb}
                        onChange={onBleedColorChange}
                        allowAlpha={false}
                      />
                    </div>
                  </Popover>
                </div>
              ) : (
                <Text as="span" variant="bodySm" alignment="center">
                  {label}
                </Text>
              )}
            </div>
          );
        })}
      </div>
    </BlockStack>
  );
}
