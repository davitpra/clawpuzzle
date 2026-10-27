import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Button,
  Select,
  RangeSlider,
  Checkbox,
  Box,
  Divider,
  Badge,
  ColorPicker,
  Collapsible,
} from "@shopify/polaris";
import type { EnhanceInfo } from "@/entities/admin/api";
import type { HsbColor } from "@/lib/colorUtils";
import {
  BLEED_MM,
  GOOD_DPI,
  PRINT_DPI,
  dpiTone,
  formatPrintSize,
  type AspectCrop,
} from "./printStudio";

// "3:4" a partir de un ancho/alto cualquiera (px o pulgadas).
function ratioLabel(w: number, h: number): string {
  const known = [
    [1, 1],
    [2, 3],
    [3, 2],
    [3, 4],
    [4, 3],
    [4, 5],
    [5, 4],
    [9, 16],
    [16, 9],
  ];
  const match = known.find(([a, b]) => Math.abs(w / h / (a / b) - 1) < 0.01);
  return match ? `${match[0]}:${match[1]}` : (w / h).toFixed(2);
}

// Panel de controles del estudio de impresión: tamaño de impresión (va primero:
// sin él no hay DPI, guías ni bleed), upscale IA, ajustes de imagen, bleed y
// opciones de salida.
export function PrintStudioControls({
  err,
  setErr,
  savedOk,
  setSavedOk,
  hasSource,
  currentDpi,
  currentKind,
  currentPx,
  aspectCrop,
  printInches,
  info,
  upscaleFactor,
  setUpscaleFactor,
  upscaleResultPx,
  upscaleResultDpi,
  upscaleUseful,
  framedDpi,
  canAct,
  upscaling,
  onUpscale,
  brightness,
  setBrightness,
  contrast,
  setContrast,
  saturation,
  setSaturation,
  sharpen,
  setSharpen,
  improve,
  setImprove,
  fitToFormat,
  setFitToFormat,
  previewing,
  onPreview,
  printSizeControl,
  bleedEnabled,
  setBleedEnabled,
  bleedHsb,
  bleedColor,
  onBleedColorChange,
  format,
  setFormat,
  reverting,
  busy,
  onRevert,
  invalidatePreview,
}: {
  err: string | null;
  setErr: Dispatch<SetStateAction<string | null>>;
  savedOk: boolean;
  setSavedOk: Dispatch<SetStateAction<boolean>>;
  hasSource: boolean;
  currentDpi: number | null;
  currentKind: "saved" | "original";
  currentPx: { w: number; h: number } | null;
  aspectCrop: AspectCrop | null;
  printInches: { width: number; height: number } | null;
  info: EnhanceInfo | null;
  upscaleFactor: number;
  setUpscaleFactor: Dispatch<SetStateAction<number>>;
  upscaleResultPx: { w: number; h: number } | null;
  upscaleResultDpi: number | null;
  upscaleUseful: boolean;
  framedDpi: number | null;
  canAct: boolean;
  upscaling: boolean;
  onUpscale: () => void;
  brightness: number;
  setBrightness: Dispatch<SetStateAction<number>>;
  contrast: number;
  setContrast: Dispatch<SetStateAction<number>>;
  saturation: number;
  setSaturation: Dispatch<SetStateAction<number>>;
  sharpen: number;
  setSharpen: Dispatch<SetStateAction<number>>;
  improve: boolean;
  setImprove: Dispatch<SetStateAction<boolean>>;
  fitToFormat: boolean;
  setFitToFormat: Dispatch<SetStateAction<boolean>>;
  previewing: boolean;
  onPreview: () => void;
  printSizeControl: ReactNode;
  bleedEnabled: boolean;
  setBleedEnabled: Dispatch<SetStateAction<boolean>>;
  bleedHsb: HsbColor;
  bleedColor: string;
  onBleedColorChange: (hsb: HsbColor) => void;
  format: "jpeg" | "png";
  setFormat: Dispatch<SetStateAction<"jpeg" | "png">>;
  reverting: boolean;
  busy: boolean;
  onRevert: () => void;
  invalidatePreview: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const currentLabel =
    currentKind === "saved"
      ? "Imagen guardada"
      : "Imagen original (sin guardar)";
  // Con el encuadre actual el máster ya llega a PRINT_DPI sin agrandar.
  const sourceIsEnough = framedDpi !== null && framedDpi >= PRINT_DPI;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <BlockStack gap="400">
        {err && (
          <Banner tone="critical" onDismiss={() => setErr(null)}>
            {err}
          </Banner>
        )}

        {savedOk && (
          <Banner tone="success" onDismiss={() => setSavedOk(false)}>
            Imagen actualizada y guardada.
          </Banner>
        )}

        {!hasSource && (
          <Banner tone="warning">
            Este item no tiene una imagen de IA original disponible.
          </Banner>
        )}

        {currentDpi !== null && printInches && (
          <Banner tone={dpiTone(currentDpi)}>
            {currentLabel}: <strong>{currentDpi} DPI</strong> para{" "}
            {formatPrintSize(printInches)}
            {currentDpi < GOOD_DPI &&
              ` — bajo el mínimo. Se recomienda upscale.`}
          </Banner>
        )}
        {currentDpi === null &&
          info?.sourceDpi !== null &&
          info?.sourceDpi !== undefined &&
          printInches && (
            <Banner tone={info.sourceDpi < GOOD_DPI ? "warning" : "success"}>
              Resolución origen: <strong>{info.sourceDpi} DPI</strong> para{" "}
              {formatPrintSize(printInches)}
              {info.sourceDpi < GOOD_DPI &&
                ` — bajo el mínimo. Se recomienda upscale.`}
            </Banner>
          )}

        {/* Tamaño de impresión del item */}
        {printSizeControl}

        {/* Proporción: decisión de formato, no de color */}
        {printInches && (
          <BlockStack gap="200">
            {aspectCrop && currentPx && (
              <Banner tone="warning">
                {`La imagen es ${ratioLabel(currentPx.w, currentPx.h)} y el formato ${ratioLabel(printInches.width, printInches.height)}: se pierde ~${Math.round(aspectCrop.perSide * 200)} % del ${aspectCrop.axis === "w" ? "ancho" : "alto"}. `}
                {fitToFormat
                  ? "Arrastra la imagen para elegir qué parte queda."
                  : "El archivo guardado mantendrá la proporción original y el recorte se hará al troquelar."}
              </Banner>
            )}
            <Checkbox
              label="Ajustar al formato"
              helpText="Recorta el archivo a la proporción exacta del tamaño de impresión. La zona sombreada es lo que se pierde."
              checked={fitToFormat}
              onChange={(v) => {
                setFitToFormat(v);
                invalidatePreview();
              }}
            />
            {fitToFormat && (
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">
                  Arrastra la imagen y usa el zoom junto a la vista para
                  encuadrarla dentro del corte.
                </Text>
                {framedDpi !== null && (
                  <Box>
                    <Badge tone={dpiTone(framedDpi)}>
                      {`Al guardar: ${framedDpi} DPI`}
                    </Badge>
                  </Box>
                )}
              </BlockStack>
            )}
          </BlockStack>
        )}

        <Divider />

        {/* Upscale section */}
        <BlockStack gap="200">
          <Text as="p" variant="headingSm">
            Upscale con IA
          </Text>
          {sourceIsEnough ? (
            <Text as="span" variant="bodySm" tone="subdued">
              Con este tamaño y encuadre el archivo ya llega a {PRINT_DPI} DPI;
              agrandar no mejora la impresión.
            </Text>
          ) : (
            <>
              {info?.hasUpscaledBase && (
                <Banner tone="info">
                  Imagen ya agrandada con IA. Usa el botón para volver a
                  ejecutar el motor desde la imagen original con un factor
                  diferente.
                </Banner>
              )}
              <RangeSlider
                label="Factor de upscale"
                min={1}
                max={8}
                step={0.5}
                value={upscaleFactor}
                onChange={(v) => {
                  setUpscaleFactor(v as number);
                  invalidatePreview();
                }}
                output
              />
              {upscaleResultPx && upscaleResultDpi !== null && (
                <InlineStack gap="300" blockAlign="center" wrap>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {`Al guardar: ${upscaleResultPx.w} × ${upscaleResultPx.h} px`}
                  </Text>
                  <Badge tone={dpiTone(upscaleResultDpi)}>
                    {`${upscaleResultDpi} DPI`}
                  </Badge>
                </InlineStack>
              )}
              <Text as="span" variant="bodySm" tone="subdued">
                {`El archivo guardado se limita a ${PRINT_DPI} DPI. Solo este botón ejecuta el motor de IA; los ajustes de abajo se guardan sin volver a agrandar.`}
              </Text>
              <Box>
                <Button
                  loading={upscaling}
                  disabled={!canAct || upscaleFactor <= 1 || !upscaleUseful}
                  onClick={onUpscale}
                >
                  {info?.hasUpscaledBase
                    ? "Volver a agrandar con IA"
                    : "Agrandar con IA"}
                </Button>
              </Box>
              {upscaleFactor > 1 && !upscaleUseful && (
                <Text as="span" variant="bodySm" tone="subdued">
                  Con este factor el DPI final no sube: el archivo se limita a{" "}
                  {PRINT_DPI} DPI.
                </Text>
              )}
            </>
          )}
        </BlockStack>

        <Divider />

        {/* Sharp adjustments */}
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="headingSm">
              Ajustes de imagen
            </Text>
            <Button
              variant="plain"
              size="slim"
              disclosure={adjustOpen ? "up" : "down"}
              onClick={() => setAdjustOpen((value) => !value)}
              ariaExpanded={adjustOpen}
              ariaControls="print-studio-adjustments"
            >
              {adjustOpen ? "Ocultar" : "Mostrar"}
            </Button>
          </InlineStack>
          <Collapsible open={adjustOpen} id="print-studio-adjustments">
            <BlockStack gap="300">
              <RangeSlider
                label="Brillo"
                min={-50}
                max={100}
                value={brightness}
                onChange={(v) => {
                  setBrightness(v as number);
                  invalidatePreview();
                }}
                output
              />
              <RangeSlider
                label="Contraste"
                min={-50}
                max={100}
                value={contrast}
                onChange={(v) => {
                  setContrast(v as number);
                  invalidatePreview();
                }}
                output
              />
              <RangeSlider
                label="Saturación"
                min={-50}
                max={100}
                value={saturation}
                onChange={(v) => {
                  setSaturation(v as number);
                  invalidatePreview();
                }}
                output
              />
              <RangeSlider
                label="Nitidez"
                min={0}
                max={200}
                step={10}
                value={sharpen}
                onChange={(v) => {
                  setSharpen(v as number);
                  invalidatePreview();
                }}
                output
              />
              <Checkbox
                label="Mejora automática"
                helpText="Auto-niveles: normaliza el rango tonal."
                checked={improve}
                onChange={(v) => {
                  setImprove(v);
                  invalidatePreview();
                }}
              />
              <Box>
                <Button
                  loading={previewing}
                  disabled={!canAct}
                  onClick={onPreview}
                >
                  Previsualizar exacto
                </Button>
              </Box>
            </BlockStack>
          </Collapsible>
        </BlockStack>

        <Divider />

        {/* Bleed — sin tamaño de impresión el backend no puede medirlo. */}
        <BlockStack gap="300">
          <Checkbox
            label={`Añadir bleed ${BLEED_MM} mm`}
            helpText={
              printInches
                ? `Extiende el fondo ${BLEED_MM} mm en cada lado para el sangrado del troquel.`
                : "Elige un tamaño de impresión arriba para poder añadir bleed."
            }
            disabled={!printInches}
            checked={bleedEnabled && Boolean(printInches)}
            onChange={(v) => {
              setBleedEnabled(v);
              invalidatePreview();
            }}
          />
          {bleedEnabled && printInches && (
            <BlockStack gap="200">
              <Text as="span" variant="bodySm">
                Color de fondo del bleed
              </Text>
              <ColorPicker
                color={bleedHsb}
                onChange={onBleedColorChange}
                allowAlpha={false}
              />
              <Text as="span" variant="bodySm" tone="subdued">
                {bleedColor}
              </Text>
            </BlockStack>
          )}
        </BlockStack>

        <Divider />

        {/* Output options */}
        <BlockStack gap="200">
          <Select
            label="Formato de salida"
            options={[
              { label: "JPEG (recomendado)", value: "jpeg" },
              { label: "PNG (sin pérdida)", value: "png" },
            ]}
            value={format}
            onChange={(v) => {
              setFormat(v as "jpeg" | "png");
              invalidatePreview();
            }}
          />
        </BlockStack>

        {info?.alreadyEnhanced && (
          <>
            <Divider />
            <Button
              variant="plain"
              tone="critical"
              loading={reverting}
              disabled={busy}
              onClick={onRevert}
            >
              Revertir al original
            </Button>
          </>
        )}
      </BlockStack>
    </div>
  );
}
