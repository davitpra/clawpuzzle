"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BlockStack,
  Box,
  Card,
  Layout,
  InlineStack,
  Text,
  Spinner,
  Page,
} from "@shopify/polaris";
import {
  adminApi,
  BleedMode,
  EnhanceInfo,
  EnhanceOptions,
  PrintCrop,
} from "@/entities/admin/api";
import { cloudinaryDownloadUrl } from "@/shared/lib/cloudinary";
import { hexToHsb, hsbToHex, HsbColor } from "@/lib/colorUtils";
import ImagePreviewModal from "@/app/admin/_components/ImagePreviewModal";
import {
  DEFAULT_UPSCALE_FACTOR,
  maxUsefulUpscale,
  CENTER_CROP,
  computeAspectCrop,
  computePrintGeometry,
  dpiFor,
} from "./printStudio";
import { PrintStudioStage } from "./PrintStudioStage";
import { PrintStudioControls } from "./PrintStudioControls";
import { PrintSizeSelect } from "./PrintSizeSelect";

// Id fijo: un nuevo guardado reemplaza al anterior en vez de apilarse.
const SAVED_TOAST_ID = "print-studio-saved";

export default function PrintStudioWorkspace({
  orderId,
  itemId,
}: {
  orderId: string;
  itemId: string;
}) {
  const [info, setInfo] = useState<EnhanceInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  // URL guardada durante esta sesión para mostrar el resultado inmediatamente.
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ src: string; title: string } | null>(null);
  const [measuredPx, setMeasuredPx] = useState<{ w: number; h: number } | null>(
    null,
  );

  // Controls
  const [upscaleFactor, setUpscaleFactor] = useState(DEFAULT_UPSCALE_FACTOR);
  const [upscaling, setUpscaling] = useState(false);
  const [crop, setCrop] = useState<PrintCrop>(CENTER_CROP);
  const [bleedEnabled, setBleedEnabled] = useState(false);
  const [bleedColor, setBleedColor] = useState("#ffffff");
  const [bleedMode, setBleedMode] = useState<BleedMode>("extend");
  const [bleedHsb, setBleedHsb] = useState<HsbColor>({
    hue: 0,
    saturation: 0,
    brightness: 1,
  });
  const [showGuides, setShowGuides] = useState(true);

  const sourceUrl = info?.sourceUrl ?? null;
  // Full-res current print image — used for client-side dimension measurement
  // and zoom.
  const currentImageUrl = savedUrl ?? info?.printImageUrl ?? sourceUrl;
  // Con tamaño de impresión el stage encuadra siempre (con o sin guías) sobre
  // el original sin recortar: el máster guardado ya está recortado y se
  // recortaría dos veces.
  const framing = Boolean(info?.printInches);
  const displayUrl = framing ? sourceUrl : currentImageUrl;

  useEffect(() => {
    let active = true;
    const firstLoad = !info;
    (async () => {
      try {
        const data = await adminApi.orders.enhanceInfo(orderId, itemId);
        if (!active) return;
        setInfo(data);
        // Solo inicializa controles en la primera carga; los refresh posteriores
        // actualizan la imagen sin pisar los ajustes del admin.
        if (firstLoad) {
          if (data.printCrop) setCrop(data.printCrop);
          if (data.bleedColor) {
            setBleedColor(data.bleedColor);
            setBleedHsb(hexToHsb(data.bleedColor));
          }
          // Only suggest an upscale when the image hasn't been enhanced yet.
          if (!data.alreadyEnhanced) {
            if (data.recommendedUpscale > 0) {
              setUpscaleFactor(data.recommendedUpscale);
            }
          } else {
            // Already enhanced — reset slider to 1 so the user must explicitly
            // choose a factor before re-running the AI upscale.
            setUpscaleFactor(1);
          }
        }
      } catch (e) {
        if (active) setErr((e as Error).message);
      } finally {
        if (active) setLoadingInfo(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, itemId]);

  // Reset measured dimensions when the current image URL changes.
  useEffect(() => {
    setMeasuredPx(null);
  }, [currentImageUrl]);

  // Cualquier cambio deja obsoleto el aviso de "guardado": se cierra.
  const markUnsaved = useCallback(() => toast.dismiss(SAVED_TOAST_ID), []);

  function updateCrop(next: PrintCrop) {
    setCrop(next);
    markUnsaved();
  }

  function updateBleedMode(mode: BleedMode) {
    setBleedMode(mode);
    markUnsaved();
  }

  function updateBleedColor(hsb: HsbColor) {
    setBleedHsb(hsb);
    setBleedColor(hsbToHex(hsb));
    markUnsaved();
  }

  const busy = applying || reverting || upscaling;
  const hasSource = Boolean(info?.sourceUrl);
  const canAct = hasSource && !busy && !loadingInfo;

  // Sin tamaño de impresión el backend rechaza el bleed: no se envía.
  const applyBleed = bleedEnabled && Boolean(info?.printInches);

  // El slider no pasa del factor que ya llega a PRINT_DPI; si el encuadre
  // cambia y baja el techo, el factor elegido se recorta sin perderse.
  const upscaleMax = maxUsefulUpscale(info, { fitToFormat: true, crop });
  const effectiveUpscale = Math.min(upscaleFactor, upscaleMax);

  // Derived print geometry (guides, upscale result) — pure, no backend call.
  const {
    printInches,
    cutInsetW,
    cutInsetH,
    safeInsetW,
    safeInsetH,
    stageAspect,
    upscaleResultPx,
    upscaleResultDpi,
    framedDpi,
    upscaleUseful,
  } = computePrintGeometry(info, effectiveUpscale, {
    fitToFormat: true,
    bleed: applyBleed,
    crop,
  });

  // Qué imagen se mide: el máster guardado o, si no hay, el original de IA.
  const currentKind =
    savedUrl || info?.printImageUrl
      ? ("saved" as const)
      : ("original" as const);
  const currentPx =
    measuredPx ??
    (info?.sourcePx
      ? { w: info.sourcePx.width, h: info.sourcePx.height }
      : null);
  const aspectCrop =
    currentPx && printInches ? computeAspectCrop(currentPx, printInches) : null;

  // DPI of the current print image as measured client-side from the delivered URL.
  const currentDpi =
    measuredPx && printInches ? dpiFor(measuredPx, printInches) : null;

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleUpscale() {
    setUpscaling(true);
    try {
      const opts: EnhanceOptions = {
        upscaleFactor: effectiveUpscale > 1 ? effectiveUpscale : undefined,
        fitToFormat: true,
        crop,
        bleed: applyBleed || undefined,
        bleedMode: applyBleed ? bleedMode : undefined,
        bleedColor:
          applyBleed && bleedMode === "solid" ? bleedColor : undefined,
      };
      const { printImageUrl } = await adminApi.orders.enhance(
        orderId,
        itemId,
        opts,
      );
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              printImageUrl,
              alreadyEnhanced: true,
              hasUpscaledBase: true,
            }
          : prev,
      );
      setSavedUrl(printImageUrl);
      toast.success("Imagen actualizada y guardada.", { id: SAVED_TOAST_ID });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpscaling(false);
    }
  }

  async function handleSave() {
    setApplying(true);
    try {
      // Never pass upscaleFactor here — "Guardar" only re-applies crop/bleed
      // on the existing high-res base (or original if not upscaled yet).
      const opts: EnhanceOptions = {
        fitToFormat: true,
        crop,
        bleed: applyBleed || undefined,
        bleedMode: applyBleed ? bleedMode : undefined,
        bleedColor:
          applyBleed && bleedMode === "solid" ? bleedColor : undefined,
      };
      const { printImageUrl } = await adminApi.orders.enhance(
        orderId,
        itemId,
        opts,
      );
      setInfo((prev) =>
        prev ? { ...prev, printImageUrl, alreadyEnhanced: true } : prev,
      );
      setSavedUrl(printImageUrl);
      toast.success("Imagen actualizada y guardada.", { id: SAVED_TOAST_ID });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  async function handleRevert() {
    setReverting(true);
    try {
      await adminApi.orders.enhanceRevert(orderId, itemId);
      const data = await adminApi.orders.enhanceInfo(orderId, itemId);
      setInfo(data);
      setSavedUrl(null);
      markUnsaved();
    } catch (e) {
      toast.error((e as Error).message);
      setReverting(false);
    }
  }

  function handleDownload() {
    if (!currentImageUrl) return;
    const href = cloudinaryDownloadUrl(
      currentImageUrl,
      "jpg",
      `impresion-${itemId}`,
    );
    const a = document.createElement("a");
    a.href = href;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // El Page vive aquí y no en page.tsx para que Guardar/Descargar, que dependen
  // del estado del estudio, se rendericen en la misma línea que el título.
  return (
    <Page
      backAction={{ url: `/admin/orders/${orderId}`, content: "Pedido" }}
      title="Estudio de impresión"
      subtitle="Imagen generada"
      fullWidth
      primaryAction={{
        content: "Guardar cambios",
        loading: applying,
        disabled: !canAct,
        onAction: handleSave,
      }}
      secondaryActions={[
        {
          content: "Exportar Imagen",
          disabled: !currentImageUrl || loadingInfo,
          onAction: handleDownload,
        },
      ]}
    >
      {zoom && (
        <ImagePreviewModal
          src={zoom.src}
          title={zoom.title}
          onClose={() => setZoom(null)}
        />
      )}
      <BlockStack gap="400">
        {loadingInfo ? (
          <Card>
            <Box padding="600">
              <InlineStack align="center" gap="200">
                <Spinner size="small" />
                <Text as="span" tone="subdued">
                  Analizando imagen…
                </Text>
              </InlineStack>
            </Box>
          </Card>
        ) : (
          <Layout>
            <Layout.Section>
              <Card>
                <PrintStudioStage
                  currentImageUrl={currentImageUrl}
                  onMeasure={setMeasuredPx}
                  displayUrl={displayUrl}
                  framing={framing}
                  crop={crop}
                  onCropChange={updateCrop}
                  stageAspect={stageAspect}
                  bleedEnabled={applyBleed}
                  bleedMode={bleedMode}
                  bleedColor={bleedColor}
                  cutInsetW={cutInsetW}
                  cutInsetH={cutInsetH}
                  safeInsetW={safeInsetW}
                  safeInsetH={safeInsetH}
                  showGuides={showGuides}
                  onShowGuidesChange={setShowGuides}
                  printInches={printInches}
                  measuredPx={measuredPx}
                  currentDpi={currentDpi}
                  currentKind={currentKind}
                  info={info}
                  onZoom={setZoom}
                />
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <PrintStudioControls
                err={err}
                setErr={setErr}
                hasSource={hasSource}
                currentDpi={currentDpi}
                currentKind={currentKind}
                aspectCrop={aspectCrop}
                printInches={printInches}
                info={info}
                upscaleFactor={effectiveUpscale}
                upscaleMax={upscaleMax}
                setUpscaleFactor={setUpscaleFactor}
                upscaleResultPx={upscaleResultPx}
                upscaleResultDpi={upscaleResultDpi}
                upscaleUseful={upscaleUseful}
                framedDpi={framedDpi}
                canAct={canAct}
                upscaling={upscaling}
                onUpscale={handleUpscale}
                bleedEnabled={bleedEnabled}
                printSizeControl={
                  <PrintSizeSelect
                    orderId={orderId}
                    itemId={itemId}
                    info={info}
                    onInfoChange={setInfo}
                    markUnsaved={markUnsaved}
                  />
                }
                setBleedEnabled={setBleedEnabled}
                bleedMode={bleedMode}
                onBleedModeChange={updateBleedMode}
                bleedThumbUrl={displayUrl}
                bleedHsb={bleedHsb}
                bleedColor={bleedColor}
                onBleedColorChange={updateBleedColor}
                reverting={reverting}
                busy={busy}
                onRevert={handleRevert}
                markUnsaved={markUnsaved}
              />
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}
