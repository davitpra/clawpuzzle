import { useEffect, useState } from "react";
import {
  BlockStack,
  InlineStack,
  Text,
  Select,
  TextField,
  Button,
  Banner,
  Badge,
} from "@shopify/polaris";
import {
  adminApi,
  type EnhanceInfo,
  type PrintConfig,
  type PrintSizePreset,
} from "@/entities/admin/api";
import { inchesToCm } from "./printStudio";

// Tamaño de impresión de la línea. Se guarda solo en el item (anula el
// printConfig de la variante sin tocar el catálogo): sin tamaño no hay DPI,
// guías ni bleed.

const SOURCE_LABEL: Record<
  NonNullable<EnhanceInfo["printConfigSource"]>,
  string
> = {
  item: "Elegido para este item.",
  variant: "Configurado en la variante del producto.",
  title: "Leído del título de la variante.",
};

const CUSTOM = "custom";
const INHERITED = "inherited";
const CLEAR = "clear";

function sizeLabel(cfg: PrintSizePreset): string {
  return `${cfg.widthCm} × ${cfg.heightCm} cm`;
}

function sameSize(a: PrintConfig | null, b: PrintSizePreset): boolean {
  return a?.widthCm === b.widthCm && a?.heightCm === b.heightCm;
}

const num = (v: string): number | undefined => {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
};

export function PrintSizeSelect({
  orderId,
  itemId,
  info,
  onInfoChange,
  markUnsaved,
}: {
  orderId: string;
  itemId: string;
  info: EnhanceInfo | null;
  onInfoChange: (info: EnhanceInfo) => void;
  markUnsaved: () => void;
}) {
  const presets = info?.printSizePresets ?? [];
  const source = info?.printConfigSource ?? null;

  // Opción que corresponde al tamaño efectivo actual.
  const presetIndex =
    source === "item"
      ? presets.findIndex((p) => sameSize(info?.printConfig ?? null, p))
      : -1;
  const current =
    source === "item"
      ? presetIndex >= 0
        ? `preset:${presetIndex}`
        : CUSTOM
      : source
        ? INHERITED
        : "";

  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<PrintConfig>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rellena "Personalizado" con el tamaño efectivo actual.
  useEffect(() => {
    const cfg = info?.printConfig;
    if (cfg?.widthCm && cfg?.heightCm) {
      setDraft({ widthCm: cfg.widthCm, heightCm: cfg.heightCm });
    } else if (info?.printInches) {
      setDraft({
        widthCm: inchesToCm(info.printInches.width),
        heightCm: inchesToCm(info.printInches.height),
      });
    }
  }, [info?.printConfig, info?.printInches]);

  const options = [
    ...(current === "" ? [{ label: "Sin tamaño — elige uno", value: "" }] : []),
    ...(source === "variant" || source === "title"
      ? [
          {
            label: info?.printInches
              ? `De la variante (${inchesToCm(info.printInches.width)} × ${inchesToCm(info.printInches.height)} cm)`
              : "De la variante",
            value: INHERITED,
          },
        ]
      : []),
    ...presets.map((p, i) => ({ label: sizeLabel(p), value: `preset:${i}` })),
    { label: "Personalizado…", value: CUSTOM },
    ...(source === "item"
      ? [{ label: "Quitar el tamaño del item", value: CLEAR }]
      : []),
  ];

  async function save(cfg: PrintConfig | null) {
    setSaving(true);
    setError(null);
    try {
      const next = cfg
        ? await adminApi.orders.setItemPrintConfig(orderId, itemId, cfg)
        : await adminApi.orders.clearItemPrintConfig(orderId, itemId);
      onInfoChange(next);
      markUnsaved();
      setCustomOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function onSelect(value: string) {
    setError(null);
    if (value === CUSTOM) {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    if (value === CLEAR) {
      void save(null);
    } else if (value.startsWith("preset:")) {
      const preset = presets[Number(value.slice("preset:".length))];
      if (preset) void save({ ...preset });
    }
  }

  const showCustom = customOpen || (current === CUSTOM && !saving);
  const canApply = Boolean(draft.widthCm && draft.heightCm);

  return (
    <BlockStack gap="200">
      <Select
        label={
          <InlineStack gap="200" blockAlign="center">
            <span>Tamaño de impresión</span>
            {!source && <Badge tone="attention">Requerido</Badge>}
          </InlineStack>
        }
        options={options}
        value={customOpen ? CUSTOM : current}
        onChange={onSelect}
        disabled={saving || !info}
        helpText={
          source
            ? SOURCE_LABEL[source]
            : "Sin tamaño no se calculan el DPI, las guías ni el bleed."
        }
      />
      {showCustom && (
        <BlockStack gap="200">
          <InlineStack gap="200" wrap={false}>
            <TextField
              label="Ancho (cm)"
              type="number"
              autoComplete="off"
              value={draft.widthCm?.toString() ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, widthCm: num(v) }))}
            />
            <TextField
              label="Alto (cm)"
              type="number"
              autoComplete="off"
              value={draft.heightCm?.toString() ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, heightCm: num(v) }))}
            />
          </InlineStack>
          <InlineStack>
            <Button
              loading={saving}
              disabled={!canApply}
              onClick={() => void save(draft)}
            >
              Aplicar tamaño
            </Button>
          </InlineStack>
        </BlockStack>
      )}
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {saving && !showCustom && (
        <Text as="span" variant="bodySm" tone="subdued">
          Guardando tamaño…
        </Text>
      )}
    </BlockStack>
  );
}
