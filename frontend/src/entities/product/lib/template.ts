// El template del backend es el tipo de producto del storefront.
// ClawPuzzle vende dos cosas: el rompecabezas físico y packs de créditos.
//
// ClawAndSoul manejaba cinco (Digital | Canvas | Poster | Accessory | Credits)
// más un eje paralelo `artKind` (pbn | print) para distinguir el contenido.
// Con un único producto físico ese segundo eje no tiene nada que separar, así
// que desapareció: el template basta.
export type Template = "Puzzle" | "Credits";

export const TEMPLATES: Template[] = ["Puzzle", "Credits"];

/** Normaliza el valor tal como llega del backend. Sin alias legacy. */
export function normalizeTemplate(value?: string | null): string {
  return value?.trim() ?? "";
}

// Copy de cara al cliente (el storefront está en español).
const TEMPLATE_LABELS: Record<string, string> = {
  Puzzle: "Rompecabezas",
  Credits: "Créditos",
};

/** Label visible del template. Devuelve el valor normalizado tal cual si no
 *  está mapeado, o "" si viene vacío. */
export function templateLabel(value?: string | null): string {
  const normalized = normalizeTemplate(value);
  return TEMPLATE_LABELS[normalized] ?? normalized;
}
