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
  Icon,
} from "@shopify/polaris";
import { AlertTriangleIcon } from "@shopify/polaris-icons";
import type { BleedMode, EnhanceInfo } from "@/entities/admin/api";
import type { HsbColor } from "@/lib/colorUtils";
import {
  BLEED_MM,
  GOOD_DPI,
  PRINT_DPI,
  UPSCALE_STEP,
  dpiTone,
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

// Panel de controles del estudio de impresión en bloques: formato
// (va primero: sin él no hay DPI, guías ni bleed), sangrado y upscale IA. El
// encuadre vive junto a la vista, donde se arrastra la imagen.
export function PrintStudioControls({
  err,
  setErr,
  hasSource,
  currentDpi,
  currentKind,
  printInches,
  info,
  upscaleFactor,
  upscaleMax,
  setUpscaleFactor,
  upscaleResultPx,
  upscaleResultDpi,
  upscaleUseful,
  framedDpi,
  canAct,
  upscaling,
  onUpscale,
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
  markUnsaved,
}: {
  err: string | null;
  setErr: Dispatch<SetStateAction<string | null>>;
  hasSource: boolean;
  currentDpi: number | null;
  currentKind: "saved" | "original";
  printInches: { width: number; height: number } | null;
  info: EnhanceInfo | null;
  upscaleFactor: number;
  // Factor a partir del cual el archivo guardado ya llega a PRINT_DPI.
  upscaleMax: number;
  setUpscaleFactor: Dispatch<SetStateAction<number>>;
  upscaleResultPx: { w: number; h: number } | null;
  upscaleResultDpi: number | null;
  upscaleUseful: boolean;
  framedDpi: number | null;
  canAct: boolean;
  upscaling: boolean;
  onUpscale: () => void;
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
  markUnsaved: () => void;
}) {
  // null = automático: el upscale se despliega solo si hace falta.
  const [upscaleOpen, setUpscaleOpen] = useState<boolean | null>(null);
  const currentLabel =
    currentKind === "saved" ? "La imagen guardada" : "La imagen original";
  // DPI bajo el mínimo: el medido de la imagen actual o, mientras no se ha
  // medido, el de origen que calcula el backend.
  const lowDpi =
    !printInches
      ? null
      : currentDpi !== null
        ? currentDpi < GOOD_DPI
          ? { label: currentLabel, dpi: currentDpi }
          : null
        : info?.sourceDpi != null && info.sourceDpi < GOOD_DPI
          ? { label: "La imagen de origen", dpi: info.sourceDpi }
          : null;
  // Con el encuadre actual el máster ya llega a PRINT_DPI sin agrandar.
  const sourceIsEnough = framedDpi !== null && framedDpi >= PRINT_DPI;
  const upscaleExpanded = upscaleOpen ?? !sourceIsEnough;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <BlockStack gap="400">
        {err && (
          <Banner tone="critical" onDismiss={() => setErr(null)}>
            {err}
          </Banner>
        )}

        {!hasSource && (
          <Banner tone="warning">
            Este item no tiene una imagen de IA original disponible.
          </Banner>
        )}

        {/* Tamaño de impresión del item */}
        <StepCard title="Formato de impresión">{printSizeControl}</StepCard>

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
                markUnsaved();
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

        {/* Upscale IA: se despliega solo si hace falta. */}
        <StepCard
          title="Upscale con IA"
          action={
            !sourceIsEnough && (
              <Button
                variant="plain"
                size="slim"
                disclosure={upscaleExpanded ? "up" : "down"}
                onClick={() => setUpscaleOpen(!upscaleExpanded)}
                ariaExpanded={upscaleExpanded}
                ariaControls="print-studio-upscale"
              >
                {upscaleExpanded ? "Ocultar" : "Mostrar"}
              </Button>
            )
          }
        >
          {/* El veredicto completo está en la leyenda de la vista; aquí basta
              una línea junto al control que lo arregla. */}
          {lowDpi && (
            <InlineStack gap="100" blockAlign="center" wrap={false}>
              <Box>
                <Icon source={AlertTriangleIcon} tone="critical" />
              </Box>
              <Text as="span" variant="bodySm" tone="critical">
                {`${lowDpi.label} está a ${lowDpi.dpi} DPI (mín. ${GOOD_DPI})`}
              </Text>
            </InlineStack>
          )}
          <Text as="span" variant="bodySm" tone="subdued">
            {sourceIsEnough
              ? `Con este tamaño y encuadre el archivo ya llega a ${PRINT_DPI} DPI; agrandar no mejora la impresión.`
              : `Mejora la resolución hasta ${PRINT_DPI} DPI.`}
          </Text>
          {!sourceIsEnough && (
            <Collapsible open={upscaleExpanded} id="print-studio-upscale">
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
                  max={upscaleMax}
                  step={UPSCALE_STEP}
                  value={upscaleFactor}
                  onChange={(v) => {
                    setUpscaleFactor(v as number);
                    markUnsaved();
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
              </BlockStack>
            </Collapsible>
          )}
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
