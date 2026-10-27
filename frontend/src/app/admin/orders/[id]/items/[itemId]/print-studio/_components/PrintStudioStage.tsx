import { useRef, useState } from "react";
import { BlockStack, InlineStack, Text, Button, Badge } from "@shopify/polaris";
import { MinusIcon, PlusIcon, TargetIcon } from "@shopify/polaris-icons";
import type { EnhanceInfo, PrintCrop } from "@/entities/admin/api";
import {
  BLEED_MM,
  CENTER_CROP,
  MAX_CROP_ZOOM,
  clampCrop,
  cropRect,
  dpiTone,
  formatPrintSize,
} from "./printStudio";

const CROP_SHADE = "rgba(0,0,0,0.5)";
// Paso de los botones de zoom de la barra junto a la vista.
const ZOOM_STEP = 0.1;
// Alto máximo de la vista: la ventana menos la cabecera de la página, el
// padding de la tarjeta y la leyenda, para que el encuadre se vea entero.
const STAGE_MAX_H = "(100dvh - 280px)";
// Margen máximo por lado alrededor de la vista para ver lo que se recorta.
const MAX_PAD = 0.06;

// Panel izquierdo del estudio de impresión: la previsualización ("stage") con
// las guías de corte/bleed/zona segura y la barra de info (px · DPI · tamaño).
export function PrintStudioStage({
  currentImageUrl,
  onMeasure,
  displayUrl,
  framing,
  crop,
  onCropChange,
  stageAspect,
  bleedEnabled,
  bleedColor,
  cutInsetW,
  cutInsetH,
  safeInsetW,
  safeInsetH,
  showGuides,
  printInches,
  cssFilter,
  previewUrl,
  measuredPx,
  currentDpi,
  currentKind,
  info,
  onZoom,
}: {
  currentImageUrl: string | null;
  onMeasure: (px: { w: number; h: number }) => void;
  displayUrl: string | null;
  // "Ajustar al formato" con guías: la imagen se encuadra arrastrándola.
  framing: boolean;
  crop: PrintCrop;
  onCropChange: (crop: PrintCrop) => void;
  stageAspect: string;
  bleedEnabled: boolean;
  bleedColor: string;
  cutInsetW: number;
  cutInsetH: number;
  safeInsetW: number;
  safeInsetH: number;
  showGuides: boolean;
  printInches: { width: number; height: number } | null;
  cssFilter: string | undefined;
  previewUrl: string | null;
  measuredPx: { w: number; h: number } | null;
  currentDpi: number | null;
  currentKind: "saved" | "original";
  info: EnhanceInfo | null;
  onZoom: (zoom: { src: string; title: string }) => void;
}) {
  // Dimensiones de la imagen visible (puede ser la preview de 900 px): con ellas
  // se calcula qué parte queda fuera del corte por diferencia de proporción.
  const [displayPx, setDisplayPx] = useState<{
    url: string;
    w: number;
    h: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; crop: PrintCrop } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const withGuides = showGuides && printInches !== null;
  const shownPx =
    withGuides && displayPx && displayPx.url === displayUrl ? displayPx : null;
  // La preview del backend ya viene recortada, y sin "Ajustar al formato" el
  // troquel recorta centrado: en ambos casos el encuadre es el centrado.
  const editable = framing && !previewUrl && shownPx !== null;
  const rect =
    shownPx && printInches
      ? cropRect(shownPx, printInches, editable ? crop : CENTER_CROP)
      : { left: 0, top: 0, width: 1, height: 1 };
  const cropsImage = rect.width < 0.999 || rect.height < 0.999;

  // Rect de la imagen en % del contenedor: el encuadre ocupa el área de corte y
  // el resto desborda, sombreado.
  const cutW = 100 - 2 * cutInsetW;
  const cutH = 100 - 2 * cutInsetH;
  const img = {
    width: cutW / rect.width,
    height: cutH / rect.height,
    left: cutInsetW - (rect.left * cutW) / rect.width,
    top: cutInsetH - (rect.top * cutH) / rect.height,
  };
  // Margen del marco por eje (fracción del ancho / alto de la vista): lo que la
  // imagen desborda, hasta MAX_PAD por lado para que con zoom el corte no
  // encoja. El total por eje no cambia al arrastrar —el encuadre siempre cubre
  // el corte—, así que el marco no salta; solo se reparte entre los lados.
  const overflowX = Math.max(0, img.width - 100) / 100;
  const overflowY = Math.max(0, img.height - 100) / 100;
  const padX = Math.min(overflowX, 2 * MAX_PAD);
  const padY = Math.min(overflowY, 2 * MAX_PAD);
  // Mitad por lado, salvo que un lado desborde menos: entonces el resto va al otro.
  const splitPad = (before: number, overflow: number, pad: number) => {
    const b = Math.min(Math.max(0, before), overflow);
    return Math.min(Math.max(pad / 2, pad - (overflow - b)), b);
  };
  const padL = splitPad(-img.left / 100, overflowX, padX);
  const padT = splitPad(-img.top / 100, overflowY, padY);
  // Marco = vista + desborde, en unidades del ancho de la vista.
  const [aspectW, aspectH] = stageAspect.split("/").map(Number);
  const frameW = 1 + padX;
  const frameH = (1 + padY) * (aspectH / aspectW);

  // El backend recorta y luego extiende el bleed con color: la banda de bleed
  // nunca lleva imagen.
  const bleedBands =
    bleedEnabled && cropsImage
      ? [
          { left: 0, right: 0, top: 0, height: `${cutInsetH}%` },
          { left: 0, right: 0, bottom: 0, height: `${cutInsetH}%` },
          { left: 0, top: 0, bottom: 0, width: `${cutInsetW}%` },
          { right: 0, top: 0, bottom: 0, width: `${cutInsetW}%` },
        ]
      : [];

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Sobre la preview ya recortada, empezar a arrastrar la descarta y vuelve
    // al original para encuadrar.
    if (framing && previewUrl) {
      onCropChange(crop);
      return;
    }
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, crop };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    const box = containerRef.current?.getBoundingClientRect();
    if (!start || !box || !shownPx || !printInches) return;
    // Arrastrar la imagen a la derecha mueve el encuadre a la izquierda.
    const imgWidthPx = (box.width * img.width) / 100;
    const imgHeightPx = (box.height * img.height) / 100;
    onCropChange(
      clampCrop(
        {
          ...start.crop,
          x: start.crop.x - (e.clientX - start.x) / imgWidthPx,
          y: start.crop.y - (e.clientY - start.y) / imgHeightPx,
        },
        shownPx,
        printInches,
      ),
    );
  }

  function handlePointerUp() {
    dragStart.current = null;
    setDragging(false);
  }

  // Al alejar, clampCrop vuelve a meter el encuadre dentro de la imagen.
  function setZoom(zoom: number) {
    const next = { ...crop, zoom: Math.round(zoom * 100) / 100 };
    onCropChange(
      shownPx && printInches ? clampCrop(next, shownPx, printInches) : next,
    );
  }

  const isCentered =
    crop.x === CENTER_CROP.x &&
    crop.y === CENTER_CROP.y &&
    crop.zoom === CENTER_CROP.zoom;

  return (
    <>
      {/* Hidden image to measure the real delivered dimensions of the current master */}
      {currentImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentImageUrl}
          alt=""
          aria-hidden
          style={{ display: "none" }}
          onLoad={(e) =>
            onMeasure({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
        />
      )}

      {/* ── LEFT: image stage ───────────────────────────────────── */}
      <div style={{ width: "100%" }}>
        <BlockStack gap="200" inlineAlign="center">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              width: "100%",
            }}
          >
            {/* Zoom del encuadre, pegado a la vista que se arrastra */}
            {framing && withGuides && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: 4,
                  background: "#fff",
                  border: "1px solid #c9cccf",
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                <Button
                  variant="tertiary"
                  icon={PlusIcon}
                  accessibilityLabel="Acercar"
                  disabled={crop.zoom >= MAX_CROP_ZOOM}
                  onClick={() => setZoom(crop.zoom + ZOOM_STEP)}
                />
                <Text as="span" variant="bodySm" fontWeight="medium">
                  {`${Math.round(crop.zoom * 100)} %`}
                </Text>
                <Button
                  variant="tertiary"
                  icon={MinusIcon}
                  accessibilityLabel="Alejar"
                  disabled={crop.zoom <= 1}
                  onClick={() => setZoom(crop.zoom - ZOOM_STEP)}
                />
                <div
                  style={{ width: "100%", borderTop: "1px solid #e3e3e3" }}
                />
                <Button
                  variant="tertiary"
                  icon={TargetIcon}
                  accessibilityLabel="Centrar encuadre"
                  disabled={isCentered}
                  onClick={() => onCropChange(CENTER_CROP)}
                />
              </div>
            )}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {/* Con recorte, el marco se amplía justo lo que la imagen desborda
              para ver sombreado lo que se pierde sin salirse de la tarjeta. Su
              ancho se limita para que el alto quepa en la ventana. */}
              <div
                style={
                  withGuides
                    ? {
                        position: "relative",
                        width: `min(100%, calc(${STAGE_MAX_H} * ${frameW / frameH}))`,
                        aspectRatio: `${frameW} / ${frameH}`,
                        overflow: "hidden",
                        borderRadius: 6,
                      }
                    : { width: "100%" }
                }
              >
                <div
                  ref={containerRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    position: "relative",
                    width: "100%",
                    ...(editable || (framing && previewUrl)
                      ? {
                          cursor: dragging ? "grabbing" : "grab",
                          touchAction: "none",
                          userSelect: "none",
                        }
                      : {}),
                    // El contenedor de formato (caja con fondo, borde y recorte por
                    // bleed) solo se muestra cuando las guías están activas. Sin
                    // guías, la imagen se ve sola en su proporción natural.
                    ...(withGuides
                      ? {
                          position: "absolute",
                          left: `${(padL / frameW) * 100}%`,
                          top: `${((padT * aspectH) / aspectW / frameH) * 100}%`,
                          width: `${(1 / frameW) * 100}%`,
                          height: `${(aspectH / aspectW / frameH) * 100}%`,
                          background: bleedEnabled ? bleedColor : "#ebebeb",
                          borderRadius: 6,
                          border: "1px solid #c9cccf",
                          // Con recorte la imagen desborda a propósito: se ve
                          // sombreado lo que el corte va a quitar.
                          overflow: cropsImage ? "visible" : "hidden",
                        }
                      : {}),
                  }}
                >
                  {/* Con guías la imagen cubre el área de corte, como al imprimir;
                sin guías se muestra completa en su proporción natural. */}
                  {displayUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayUrl}
                      alt="Vista de impresión"
                      draggable={false}
                      onLoad={(e) =>
                        setDisplayPx({
                          url: displayUrl,
                          w: e.currentTarget.naturalWidth,
                          h: e.currentTarget.naturalHeight,
                        })
                      }
                      style={
                        withGuides
                          ? {
                              position: "absolute",
                              top: `${img.top}%`,
                              left: `${img.left}%`,
                              width: `${img.width}%`,
                              height: `${img.height}%`,
                              // El reset de Tailwind limita img a max-width: 100%; con
                              // recorte la imagen desborda a propósito.
                              maxWidth: "none",
                              objectFit: "cover",
                              objectPosition: "center",
                              display: "block",
                              filter: cssFilter,
                            }
                          : {
                              display: "block",
                              width: "auto",
                              maxWidth: "100%",
                              maxHeight: `calc${STAGE_MAX_H}`,
                              margin: "0 auto",
                              borderRadius: 6,
                              filter: cssFilter,
                            }
                      }
                    />
                  )}
                  {!displayUrl && (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: stageAspect,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#ebebeb",
                        borderRadius: 6,
                      }}
                    >
                      <Text as="span" tone="subdued" variant="bodySm">
                        Sin imagen
                      </Text>
                    </div>
                  )}

                  {/* Todo lo que queda fuera del corte, sombreado */}
                  {withGuides && cropsImage && (
                    <div
                      style={{
                        position: "absolute",
                        top: `${cutInsetH}%`,
                        left: `${cutInsetW}%`,
                        right: `${cutInsetW}%`,
                        bottom: `${cutInsetH}%`,
                        boxShadow: `0 0 0 9999px ${CROP_SHADE}`,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  {bleedBands.map((band, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        background: bleedColor,
                        pointerEvents: "none",
                        ...band,
                      }}
                    />
                  ))}

                  {/* Guides overlay */}
                  {withGuides && (
                    <>
                      {/* Cut line — red dashed (= format/trim edge) */}
                      <div
                        style={{
                          position: "absolute",
                          top: `${cutInsetH}%`,
                          left: `${cutInsetW}%`,
                          right: `${cutInsetW}%`,
                          bottom: `${cutInsetH}%`,
                          border: "1.5px dashed rgba(220,38,38,0.9)",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Safe zone — blue dashed (10mm inside the cut) */}
                      <div
                        style={{
                          position: "absolute",
                          top: `${safeInsetH}%`,
                          left: `${safeInsetW}%`,
                          right: `${safeInsetW}%`,
                          bottom: `${safeInsetH}%`,
                          border: "1.5px dashed rgba(37,99,235,0.85)",
                          pointerEvents: "none",
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Guide legend */}
          {withGuides && (
            <InlineStack gap="300" align="center" wrap>
              {bleedEnabled ? (
                <InlineStack gap="100" blockAlign="center">
                  <div
                    style={{
                      width: 18,
                      height: 10,
                      background: bleedColor,
                      border: "1px solid #c9cccf",
                    }}
                  />
                  <Text as="span" variant="bodySm" tone="subdued">
                    Bleed {BLEED_MM} mm
                  </Text>
                </InlineStack>
              ) : (
                <Text as="span" variant="bodySm" tone="subdued">
                  Sin bleed: se corta al borde
                </Text>
              )}
              <InlineStack gap="100" blockAlign="center">
                <div
                  style={{
                    width: 18,
                    height: 0,
                    borderTop: "1.5px dashed rgba(220,38,38,0.9)",
                  }}
                />
                <Text as="span" variant="bodySm" tone="subdued">
                  Corte
                </Text>
              </InlineStack>
              <InlineStack gap="100" blockAlign="center">
                <div
                  style={{
                    width: 18,
                    height: 0,
                    borderTop: "1.5px dashed rgba(37,99,235,0.85)",
                  }}
                />
                <Text as="span" variant="bodySm" tone="subdued">
                  Zona segura
                </Text>
              </InlineStack>
              {cropsImage && (
                <InlineStack gap="100" blockAlign="center">
                  <div
                    style={{ width: 18, height: 10, background: CROP_SHADE }}
                  />
                  <Text as="span" variant="bodySm" tone="subdued">
                    Se recorta
                  </Text>
                </InlineStack>
              )}
            </InlineStack>
          )}

          {previewUrl && (
            <Text as="span" variant="bodySm" tone="subdued">
              Vista previa (aprox.) — el archivo guardado no cambia hasta pulsar
              Guardar.
            </Text>
          )}

          {/* Info bar — current print image dimensions + DPI + print size */}
          <InlineStack gap="300" blockAlign="center" wrap>
            {measuredPx ? (
              <>
                <Text as="span" variant="bodySm" tone="subdued">
                  {currentKind === "saved"
                    ? "Guardada"
                    : "Original (sin guardar)"}
                  : {measuredPx.w} × {measuredPx.h} px
                </Text>
                {currentDpi !== null && (
                  <Badge
                    tone={dpiTone(currentDpi)}
                  >{`${currentDpi} DPI`}</Badge>
                )}
              </>
            ) : (
              <Text as="span" variant="bodySm" tone="subdued">
                {info?.sourcePx
                  ? `${info.sourcePx.width} × ${info.sourcePx.height} px`
                  : "— × — px"}
              </Text>
            )}
            {printInches && (
              <Text as="span" variant="bodySm" tone="subdued">
                {formatPrintSize(printInches)}
              </Text>
            )}
          </InlineStack>
          {measuredPx &&
            info?.sourcePx &&
            (measuredPx.w !== info.sourcePx.width ||
              measuredPx.h !== info.sourcePx.height) && (
              <Text as="span" variant="bodySm" tone="subdued">
                Origen: {info.sourcePx.width} × {info.sourcePx.height} px
              </Text>
            )}

          {info?.printImageUrl && (
            <Button
              variant="plain"
              onClick={() =>
                onZoom({
                  src: info.printImageUrl!,
                  title: "Imagen guardada",
                })
              }
            >
              Abrir original →
            </Button>
          )}
        </BlockStack>
      </div>
    </>
  );
}
