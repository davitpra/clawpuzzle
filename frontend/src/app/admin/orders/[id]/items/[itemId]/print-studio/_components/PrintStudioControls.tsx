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
  RangeSlider,
  Checkbox,
  Box,
  Badge,
  Card,
  Collapsible,
} from "@shopify/polaris";
import type { BleedMode, EnhanceInfo } from "@/entities/admin/api";
import type { HsbColor } from "@/lib/colorUtils";
import {
  BLEED_MM,
  GOOD_DPI,
  PRINT_DPI,
  dpiTone,
  formatPrintSize,
  type AspectCrop,
} from "./printStudio";
import { BleedModePicker } from "./BleedModePicker";

// Bloque del panel: un paso del flujo de preparación.
function StepCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text as="h2" variant="headingMd">
            {title}
          </Text>
          {action}
        </InlineStack>
        {children}
      </BlockStack>
    </Card>
  );
}

// Sección plegable dentro de "Ajustes adicionales".
function SubSection({
  id,
  title,
  summary,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <Box
      borderWidth="025"
      borderColor="border"
      borderRadius="200"
      padding="300"
    >
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" wrap={false}>
          <BlockStack gap="050">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingSm">
                {title}
              </Text>
              {badge}
            </InlineStack>
            <Text as="span" variant="bodySm" tone="subdued">
              {summary}
            </Text>
          </BlockStack>
          {children && (
            <Button
              variant="plain"
              size="slim"
              disclosure={open ? "up" : "down"}
              onClick={onToggle}
              ariaExpanded={open}
              ariaControls={id}
            >
              {open ? "Ocultar" : "Mostrar"}
            </Button>
          )}
        </InlineStack>
        {children && (
          <Collapsible open={open} id={id}>
            {children}
          </Collapsible>
        )}
      </BlockStack>
    </Box>
  );
}

// Panel de controles del estudio de impresión en bloques: formato
// (va primero: sin él no hay DPI, guías ni bleed), encuadre, sangrado y
// ajustes adicionales (upscale IA y color).
export function PrintStudioControls({
  err,
  setErr,
  savedOk,
  setSavedOk,
  hasSource,
  currentDpi,
  currentKind,
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
  previewing,
  onPreview,
  printSizeControl,
  bleedEnabled,
  setBleedEnabled,
  bleedMode,
  onBleedModeChange,
  bleedThumbUrl,
  bleedHsb,
  bleedColor,
  onBleedColorChange,
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
  previewing: boolean;
  onPreview: () => void;
  printSizeControl: ReactNode;
  bleedEnabled: boolean;
  setBleedEnabled: Dispatch<SetStateAction<boolean>>;
  bleedMode: BleedMode;
  onBleedModeChange: (mode: BleedMode) => void;
  bleedThumbUrl: string | null;
  bleedHsb: HsbColor;
  bleedColor: string;
  onBleedColorChange: (hsb: HsbColor) => void;
  reverting: boolean;
  busy: boolean;
  onRevert: () => void;
  invalidatePreview: () => void;
}) {
  const [extrasOpen, setExtrasOpen] = useState(true);
  // null = automático: el upscale se despliega solo si hace falta.
  const [upscaleOpen, setUpscaleOpen] = useState<boolean | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const currentLabel =
    currentKind === "saved"
      ? "Imagen guardada"
      : "Imagen original (sin guardar)";
  // Con el encuadre actual el máster ya llega a PRINT_DPI sin agrandar.
  const sourceIsEnough = framedDpi !== null && framedDpi >= PRINT_DPI;
  const colorTouched =
    brightness !== 0 ||
    contrast !== 0 ||
    saturation !== 0 ||
    sharpen !== 0 ||
    improve;

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

        {/* El DPI y su veredicto ya están en la leyenda de la vista; aquí solo
            se avisa cuando no llega al mínimo. */}
        {currentDpi !== null && currentDpi < GOOD_DPI && printInches && (
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
        <StepCard title="Formato de impresión">{printSizeControl}</StepCard>

        {/* Proporción: decisión de formato, no de color */}
        <StepCard title="Encuadre de imagen">
          {printInches ? (
            aspectCrop ? (
              <Banner
                tone="warning"
                title={`La imagen se recorta un ${Math.round(aspectCrop.perSide * 200)} % del ${aspectCrop.axis === "w" ? "ancho" : "alto"}.`}
              >
                Arrastra la imagen y usa el zoom junto a la vista para elegir
                qué parte queda. La zona sombreada es lo que se pierde.
              </Banner>
            ) : (
              <Text as="span" variant="bodySm" tone="subdued">
                La imagen ya tiene la proporción del formato. Usa el zoom junto
                a la vista para ajustar el encuadre.
              </Text>
            )
          ) : (
            <Text as="span" variant="bodySm" tone="subdued">
              Elige un tamaño de impresión para encuadrar la imagen.
            </Text>
          )}
        </StepCard>

        {/* Bleed — sin tamaño de impresión el backend no puede medirlo. */}
        <StepCard title="Sangrado (bleed)">
          <BlockStack gap="300">
            <Checkbox
              label={`Añadir sangrado de ${BLEED_MM} mm`}
              helpText={
                printInches
                  ? `Extiende el fondo ${BLEED_MM} mm en cada lado para el sangrado de impresión.`
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
              <BleedModePicker
                value={bleedMode}
                onChange={onBleedModeChange}
                thumbUrl={bleedThumbUrl}
                bleedHsb={bleedHsb}
                bleedColor={bleedColor}
                onBleedColorChange={onBleedColorChange}
              />
            )}
          </BlockStack>
        </StepCard>

        {/* Upscale IA y ajustes de color, plegados por defecto */}
        <StepCard
          title="Ajustes adicionales"
          action={
            <Button
              variant="plain"
              size="slim"
              disclosure={extrasOpen ? "up" : "down"}
              onClick={() => setExtrasOpen((value) => !value)}
              ariaExpanded={extrasOpen}
              ariaControls="print-studio-extras"
            >
              {extrasOpen ? "Ocultar" : "Mostrar"}
            </Button>
          }
        >
          <Collapsible open={extrasOpen} id="print-studio-extras">
            <BlockStack gap="300">
              <SubSection
                id="print-studio-upscale"
                title="Upscale con IA"
                summary={
                  sourceIsEnough
                    ? `Con este tamaño y encuadre el archivo ya llega a ${PRINT_DPI} DPI; agrandar no mejora la impresión.`
                    : `Mejora la resolución hasta ${PRINT_DPI} DPI.`
                }
                open={upscaleOpen ?? !sourceIsEnough}
                onToggle={() =>
                  setUpscaleOpen((value) => !(value ?? !sourceIsEnough))
                }
              >
                {!sourceIsEnough && (
                  <BlockStack gap="200">
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
                      {`El archivo guardado se limita a ${PRINT_DPI} DPI. Solo este botón ejecuta el motor de IA; los demás ajustes se guardan sin volver a agrandar.`}
                    </Text>
                    <Box>
                      <Button
                        loading={upscaling}
                        disabled={
                          !canAct || upscaleFactor <= 1 || !upscaleUseful
                        }
                        onClick={onUpscale}
                      >
                        {info?.hasUpscaledBase
                          ? "Volver a agrandar con IA"
                          : "Agrandar con IA"}
                      </Button>
                    </Box>
                    {upscaleFactor > 1 && !upscaleUseful && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        Con este factor el DPI final no sube: el archivo se
                        limita a {PRINT_DPI} DPI.
                      </Text>
                    )}
                  </BlockStack>
                )}
              </SubSection>

              <SubSection
                id="print-studio-adjustments"
                title="Color y ajustes de imagen"
                summary="Brillo, contraste, saturación y nitidez."
                badge={colorTouched ? <Badge>Modificado</Badge> : undefined}
                open={adjustOpen}
                onToggle={() => setAdjustOpen((value) => !value)}
              >
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
              </SubSection>
            </BlockStack>
          </Collapsible>
        </StepCard>

        {info?.alreadyEnhanced && (
          <Box>
            <Button
              variant="plain"
              tone="critical"
              loading={reverting}
              disabled={busy}
              onClick={onRevert}
            >
              Revertir al original
            </Button>
          </Box>
        )}
      </BlockStack>
    </div>
  );
}
