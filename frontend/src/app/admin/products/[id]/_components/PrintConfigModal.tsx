"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  FormLayout,
  TextField,
  Text,
  BlockStack,
  Banner,
} from "@shopify/polaris";
import {
  adminApi,
  type AdminProductVariantLink,
  type PrintConfig,
} from "@/entities/admin/api";

/**
 * Especificación de impresión de una variante de puzzle.
 *
 * Sustituye al modal de Pictorem de ClawAndSoul, que pedía material, tipo y
 * opciones de un catálogo POD externo. Con producción propia lo único que el
 * sistema necesita saber es el tamaño físico —de ahí sale el DPI del máster y,
 * con él, la recomendación de upscale— y los márgenes del troquel.
 */
export function PrintConfigModal({
  productId,
  variant,
  onClose,
  onSaved,
}: {
  productId: string;
  variant: AdminProductVariantLink | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cfg, setCfg] = useState<PrintConfig>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCfg(variant?.printConfig ?? {});
    setError(null);
  }, [variant]);

  const num = (v: string): number | undefined => {
    const n = Number(v);
    return v.trim() === "" || Number.isNaN(n) ? undefined : n;
  };

  const handleSave = async () => {
    if (!variant) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.products.updateVariant(productId, variant.shopifyVariantId, {
        printConfig: cfg,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // El DPI que alcanzaría un arte de 1024 px de ancho al tamaño configurado:
  // sirve para ver de un vistazo cuánto upscale hará falta.
  const dpiHint =
    cfg.widthCm && cfg.widthCm > 0
      ? Math.round(1024 / (cfg.widthCm / 2.54))
      : null;

  return (
    <Modal
      open={variant !== null}
      onClose={onClose}
      title={`Impresión — ${variant?.format.displayName ?? ""}`}
      primaryAction={{ content: "Guardar", onAction: handleSave, loading: saving }}
      secondaryActions={[{ content: "Cancelar", onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {error && <Banner tone="critical">{error}</Banner>}

          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Ancho impreso (cm)"
                type="number"
                autoComplete="off"
                value={cfg.widthCm?.toString() ?? ""}
                onChange={(v) => setCfg((c) => ({ ...c, widthCm: num(v) }))}
              />
              <TextField
                label="Alto impreso (cm)"
                type="number"
                autoComplete="off"
                value={cfg.heightCm?.toString() ?? ""}
                onChange={(v) => setCfg((c) => ({ ...c, heightCm: num(v) }))}
              />
            </FormLayout.Group>

            {/* La sangre no se configura: es fija de 3 mm en el Print Studio. */}
            <FormLayout.Group>
              <TextField
                label="Margen de seguridad (mm)"
                type="number"
                autoComplete="off"
                helpText="Zona sin contenido crítico: un ojo partido por el corte arruina la pieza."
                value={cfg.safeMarginMm?.toString() ?? ""}
                onChange={(v) => setCfg((c) => ({ ...c, safeMarginMm: num(v) }))}
              />
            </FormLayout.Group>

            <TextField
              label="DPI mínimo"
              type="number"
              autoComplete="off"
              helpText="Por debajo de esto el estudio de impresión avisa. 300 es lo habitual."
              value={cfg.minDpi?.toString() ?? ""}
              onChange={(v) => setCfg((c) => ({ ...c, minDpi: num(v) }))}
            />
          </FormLayout>

          {dpiHint !== null && (
            <Text as="span" tone="subdued" variant="bodySm">
              Un arte de 1024 px de ancho daría ~{dpiHint} DPI a este tamaño.
            </Text>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
