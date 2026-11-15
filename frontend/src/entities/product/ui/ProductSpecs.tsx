import type { ShopifyProduct } from "@/lib/shopify";

interface Spec {
  icon: string;
  label: string;
  /** Valor bajo la etiqueta (desktop). */
  value: string;
  /** En mobile no hay etiqueta: el valor se explica solo ("253 piezas"). */
  shortValue: string;
}

/** "37 x 20 cm" → "37 × 20 cm". */
const formatSize = (raw: string) => raw.replace(/\s*x\s*/gi, " × ");

/** "2 - 3 horas" → "2–3 h". */
const formatDuration = (raw: string) =>
  raw.replace(/\s*-\s*/g, "–").replace(/\s*horas?\b/i, " h");

/** Metafield rating `{"value":"5.0","scale_max":"6.0"}` → "5/6". */
function formatRating(raw: string): string | null {
  try {
    const { value, scale_max } = JSON.parse(raw) as {
      value?: string;
      scale_max?: string;
    };
    const v = Number(value);
    const max = Number(scale_max);
    if (!Number.isFinite(v) || !Number.isFinite(max)) return null;
    return `${Math.round(v)}/${Math.round(max)}`;
  } catch {
    return null;
  }
}

function buildSpecs(product: ShopifyProduct): Spec[] {
  const specs: Spec[] = [];

  const pets = product.specMascotas?.value;
  if (pets) {
    specs.push({
      icon: "pets",
      label: "Mascotas",
      value: pets,
      shortValue: `${pets} ${pets === "1" ? "mascota" : "mascotas"}`,
    });
  }

  const size = product.specTamano?.value;
  if (size) {
    const v = formatSize(size);
    specs.push({ icon: "open_in_full", label: "Tamaño", value: v, shortValue: v });
  }

  const pieces = product.specPiezas?.value;
  if (pieces) {
    specs.push({
      icon: "extension",
      label: "Piezas",
      value: pieces,
      shortValue: `${pieces} piezas`,
    });
  }

  const assembly = product.specArmado?.value;
  if (assembly) {
    const v = formatDuration(assembly);
    specs.push({ icon: "schedule", label: "Armado", value: v, shortValue: v });
  }

  const difficulty = product.specDificultad?.value
    ? formatRating(product.specDificultad.value)
    : null;
  if (difficulty) {
    specs.push({
      icon: "signal_cellular_alt",
      label: "Dificultad",
      value: difficulty,
      shortValue: difficulty,
    });
  }

  return specs;
}

interface ProductSpecsProps {
  product: ShopifyProduct;
}

/**
 * Franja de características del rompecabezas, leída de los metafields
 * `custom.*` del producto en Shopify. Una columna que no tiene valor no se
 * muestra; si no hay ninguna, no se muestra la franja.
 */
export default function ProductSpecs({ product }: ProductSpecsProps) {
  const specs = buildSpecs(product);
  if (specs.length === 0) return null;

  return (
    <dl
      className="grid border-y border-text-main/10 py-4 divide-x divide-text-main/10 sm:divide-x-0"
      style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))` }}
    >
      {specs.map((spec) => (
        <div
          key={spec.label}
          className="flex flex-col items-center gap-1 px-1 text-center"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[24px] leading-none text-text-main"
          >
            {spec.icon}
          </span>
          <dt className="sr-only font-body text-xs text-text-muted sm:not-sr-only">
            {spec.label}
          </dt>
          <dd className="font-body text-xs font-bold text-text-main sm:text-sm">
            <span className="sm:hidden">{spec.shortValue}</span>
            <span className="hidden sm:inline">{spec.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
