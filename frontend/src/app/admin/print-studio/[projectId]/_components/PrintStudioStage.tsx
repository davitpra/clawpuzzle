import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Checkbox,
  RangeSlider,
} from "@shopify/polaris";
import type { BleedMode, EnhanceInfo, PrintCrop } from "@/entities/admin/api";
import {
  BLEED_MM,
  CENTER_CROP,
  MAX_CROP_ZOOM,
  clampCrop,
  cropRect,
  dpiTone,
  dpiVerdict,
  formatPrintSize,
} from "./printStudio";
import { BleedFill } from "./BleedFill";

const BLEED_MODE_LEGEND: Record<BleedMode, string> = {
  extend: "imagen extendida",
  mirror: "bordes reflejados",
  solid: "color sólido",
};

// Fila etiqueta/valor de la ficha de la imagen, con el valor a la derecha.
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <InlineStack align="space-between" blockAlign="center" wrap={false}>
      <Text as="span" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <Text as="span" variant="bodySm">
        {children}
      </Text>
    </InlineStack>
  );
}

const CROP_SHADE = "rgba(0,0,0,0.5)";
// Paso del slider de zoom del encuadre.
const ZOOM_STEP = 0.1;
// Alto máximo de la vista hasta medir dónde empieza: la ventana menos una
// estimación de la cabecera y el padding de la tarjeta.
const STAGE_FALLBACK_MAX_H = "calc(100dvh - 280px)";
// Lo que queda bajo la vista: padding inferior de la tarjeta y de la página.
const BOTTOM_GAP = 40;
// Alto mínimo de la vista en ventanas muy bajas.
const MIN_STAGE_H = 320;
// Margen máximo por lado alrededor de la vista para ver lo que se recorta.
const MAX_PAD = 0.06;

// Panel izquierdo del estudio de impresión: la previsualización ("stage") en el
// formato de impresión con su bleed —y, opcionalmente, las guías de corte y zona
// segura— y, a su derecha, la leyenda y la info (px · DPI · tamaño).
export function PrintStudioStage({
  currentImageUrl,
  onMeasure,
  displayUrl,
  framing,
  crop,
  onCropChange,
  stageAspect,
  bleedEnabled,
  bleedMode,
  bleedColor,
  cutInsetW,
  cutInsetH,
  safeInsetW,
  safeInsetH,
  showGuides,
  onShowGuidesChange,
  printInches,
  measuredPx,
  currentDpi,
  framedDpi,
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
  bleedMode: BleedMode;
  bleedColor: string;
  cutInsetW: number;
  cutInsetH: number;
  safeInsetW: number;
  safeInsetH: number;
  showGuides: boolean;
  onShowGuidesChange: (checked: boolean) => void;
  printInches: { width: number; height: number } | null;
  measuredPx: { w: number; h: number } | null;
  currentDpi: number | null;
  // DPI del máster que saldría al guardar con el encuadre actual.
  framedDpi: number | null;
  currentKind: "saved" | "original";
  info: EnhanceInfo | null;
  onZoom: (zoom: { src: string; title: string }) => void;
}) {
  // Dimensiones de la imagen visible: con ellas
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

  // Alto máximo de la vista: desde donde empieza hasta el pie de la ventana, para
  // que ocupe todo el alto disponible sin hacer scroll.
  const stageRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | null>(null);
  useLayoutEffect(() => {
    function measure() {
      const el = stageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setMaxH(Math.max(MIN_STAGE_H, window.innerHeight - top - BOTTOM_GAP));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const stageMaxH = maxH !== null ? `${maxH}px` : STAGE_FALLBACK_MAX_H;

  // Con tamaño de impresión la vista es siempre la final (recorte + bleed); las
  // guías solo añaden las líneas y el sombreado de lo que se recorta.
  const framed = printInches !== null;
  const withGuides = showGuides && framed;
  const shownPx =
    framed && displayPx && displayPx.url === displayUrl ? displayPx : null;
  // Sin "Ajustar al formato" el troquel recorta centrado.
  const editable = framing && shownPx !== null;
  const rect =
    shownPx && printInches
      ? cropRect(shownPx, printInches, editable ? crop : CENTER_CROP)
      : { left: 0, top: 0, width: 1, height: 1 };
  const cropsImage = rect.width < 0.999 || rect.height < 0.999;
  // Sin guías la imagen no desborda: se recorta en el borde del bleed.
  const showOverflow = withGuides && cropsImage;

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
  const padX = showOverflow ? Math.min(overflowX, 2 * MAX_PAD) : 0;
  const padY = showOverflow ? Math.min(overflowY, 2 * MAX_PAD) : 0;
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

  // El backend recorta y luego extiende el bleed: la banda nunca lleva la
  // imagen de fuera del encuadre, sino el color o la imagen extendida/reflejada.
  const solidBleed = bleedEnabled && bleedMode === "solid";
  const bleedBands =
    solidBleed && cropsImage
      ? [
          { left: 0, right: 0, top: 0, height: `${cutInsetH}%` },
          { left: 0, right: 0, bottom: 0, height: `${cutInsetH}%` },
          { left: 0, top: 0, bottom: 0, width: `${cutInsetW}%` },
          { right: 0, top: 0, bottom: 0, width: `${cutInsetW}%` },
        ]
      : [];

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
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
            <div
              ref={stageRef}
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
                  framed
                    ? {
                        position: "relative",
                        width: `min(100%, calc(${stageMaxH} * ${frameW / frameH}))`,
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
                    ...(editable
                      ? {
                          cursor: dragging ? "grabbing" : "grab",
                          touchAction: "none",
                          userSelect: "none",
                        }
                      : {}),
                    // El contenedor de formato (caja con fondo, borde y recorte por
                    // bleed) se muestra siempre que hay tamaño de impresión. Sin
                    // él, la imagen se ve sola en su proporción natural.
                    ...(framed
                      ? {
                          position: "absolute",
                          left: `${(padL / frameW) * 100}%`,
                          top: `${((padT * aspectH) / aspectW / frameH) * 100}%`,
                          width: `${(1 / frameW) * 100}%`,
                          height: `${(aspectH / aspectW / frameH) * 100}%`,
                          background: solidBleed ? bleedColor : "#ebebeb",
                          borderRadius: 6,
                          border: "1px solid #c9cccf",
                          // Con guías y recorte la imagen desborda a propósito: se
                          // ve sombreado lo que el corte va a quitar.
                          overflow: showOverflow ? "visible" : "hidden",
                        }
                      : {}),
                  }}
                >
                  {/* Con formato la imagen cubre el área de corte, como al imprimir;
                sin él se muestra completa en su proporción natural. */}
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
                        framed
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
                            }
                          : {
                              display: "block",
                              width: "auto",
                              maxWidth: "100%",
                              maxHeight: stageMaxH,
                              margin: "0 auto",
                              borderRadius: 6,
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
                  {framed &&
                    bleedEnabled &&
                    bleedMode !== "solid" &&
                    displayUrl && (
                      <BleedFill
                        src={displayUrl}
                        mode={bleedMode}
                        cutInsetW={cutInsetW}
                        cutInsetH={cutInsetH}
                        imgStyle={{
                          top: `${img.top}%`,
                          left: `${img.left}%`,
                          width: `${img.width}%`,
                          height: `${img.height}%`,
                          objectFit: "cover",
                          objectPosition: "center",
                        }}
                      />
                    )}

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

            {/* Info de la imagen (px · tamaño · DPI) y leyenda de guías, a la derecha de la vista */}
            <div
              style={{
                width: 190,
                flexShrink: 0,
                padding: 12,
                background: "#fff",
                border: "1px solid #c9cccf",
                borderRadius: 8,
              }}
            >
              <BlockStack gap="300">
                {/* Ficha de la imagen: px y tamaño de impresión, y el DPI que
                    resulta de ambos al final. */}
                <BlockStack gap="200">
                  <BlockStack gap="050">
                    <Text as="h3" variant="headingXs" tone="subdued">
                      IMAGEN ACTUAL
                    </Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {currentKind === "saved"
                        ? "Máster guardado"
                        : "Imagen de origen"}
                    </Text>
                  </BlockStack>
                  <InfoRow label="Píxeles">
                    {measuredPx
                      ? `${measuredPx.w} × ${measuredPx.h}`
                      : info?.sourcePx
                        ? `${info.sourcePx.width} × ${info.sourcePx.height}`
                        : "— × —"}
                  </InfoRow>
                  {measuredPx &&
                    info?.sourcePx &&
                    (measuredPx.w !== info.sourcePx.width ||
                      measuredPx.h !== info.sourcePx.height) && (
                      <InfoRow label="Origen">
                        {info.sourcePx.width} × {info.sourcePx.height}
                      </InfoRow>
                    )}
                  <InfoRow label="Impresión">
                    {printInches ? formatPrintSize(printInches) : "—"}
                  </InfoRow>
                  {currentDpi !== null && (
                    <BlockStack gap="050">
                      <InfoRow label="Resolución">
                        <Badge tone={dpiTone(currentDpi)}>
                          {`${currentDpi} DPI`}
                        </Badge>
                      </InfoRow>
                      <InlineStack align="end">
                        <Text as="span" variant="bodySm" tone="subdued">
                          {dpiVerdict(currentDpi)}
                        </Text>
                      </InlineStack>
                    </BlockStack>
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
                      Abrir máster guardado →
                    </Button>
                  )}
                </BlockStack>

                {/* Encuadre: zoom y posición del recorte; la posición se
                    elige arrastrando la imagen. */}
                {editable && (
                  <>
                    <div style={{ borderTop: "1px solid #e3e3e3" }} />
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingXs" tone="subdued">
                        ENCUADRE
                      </Text>
                      <RangeSlider
                        label="Zoom"
                        min={1}
                        max={MAX_CROP_ZOOM}
                        step={ZOOM_STEP}
                        value={crop.zoom}
                        output
                        onChange={(v) => setZoom(v as number)}
                        suffix={
                          <Text as="span" variant="bodySm">
                            {`${Math.round(crop.zoom * 100)} %`}
                          </Text>
                        }
                      />
                      <Text as="span" variant="bodySm" tone="subdued">
                        {cropsImage
                          ? `Se usa el ${Math.round(rect.width * 100)} % del ancho y el ${Math.round(rect.height * 100)} % del alto.`
                          : "Se usa la imagen completa."}
                      </Text>
                      {framedDpi !== null && (
                        <InfoRow label="Con este encuadre">
                          <Badge tone={dpiTone(framedDpi)}>
                            {`${framedDpi} DPI`}
                          </Badge>
                        </InfoRow>
                      )}
                      <Text as="span" variant="bodySm" tone="subdued">
                        Arrastra la imagen para mover el encuadre.
                      </Text>
                      <InlineStack>
                        <Button
                          variant="plain"
                          disabled={isCentered}
                          onClick={() => onCropChange(CENTER_CROP)}
                        >
                          Restablecer encuadre
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </>
                )}

                <div style={{ borderTop: "1px solid #e3e3e3" }} />

                <Checkbox
                  label="Mostrar guías"
                  helpText={
                    printInches ? undefined : "Elige un tamaño de impresión"
                  }
                  disabled={!printInches}
                  checked={withGuides}
                  onChange={onShowGuidesChange}
                />
                {withGuides && (
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <div
                        style={{
                          width: 18,
                          height: 0,
                          flexShrink: 0,
                          borderTop: "1.5px dashed rgba(220,38,38,0.9)",
                        }}
                      />
                      <Text as="span" variant="bodySm" tone="subdued">
                        Corte
                      </Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <div
                        style={{
                          width: 18,
                          height: 0,
                          flexShrink: 0,
                          borderTop: "1.5px dashed rgba(37,99,235,0.85)",
                        }}
                      />
                      <Text as="span" variant="bodySm" tone="subdued">
                        Zona segura
                      </Text>
                    </InlineStack>
                    {bleedEnabled ? (
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <div
                          style={{
                            width: 18,
                            height: 10,
                            flexShrink: 0,
                            background:
                              solidBleed || !displayUrl
                                ? bleedColor
                                : `center / cover no-repeat url("${displayUrl}")`,
                            border: "1px solid #c9cccf",
                          }}
                        />
                        <Text as="span" variant="bodySm" tone="subdued">
                          Bleed {BLEED_MM} mm · {BLEED_MODE_LEGEND[bleedMode]}
                        </Text>
                      </InlineStack>
                    ) : (
                      <> </>
                    )}
                    {cropsImage && (
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <div
                          style={{
                            width: 18,
                            height: 10,
                            flexShrink: 0,
                            background: CROP_SHADE,
                          }}
                        />
                        <Text as="span" variant="bodySm" tone="subdued">
                          Se recorta
                        </Text>
                      </InlineStack>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </div>
          </div>
        </BlockStack>
      </div>
    </>
  );
}
