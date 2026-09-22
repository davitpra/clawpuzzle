/**
 * Frases de espera que rotan mientras la IA genera el arte (estilo status ticker).
 *
 * Const a nivel de módulo → referencia estable para `useRotatingMessage`, y una
 * sola lista compartida por `IAThanksStep` (flujo clásico) e `IAGeneratingStep`
 * (flujo de lanzamiento).
 */
export const CRAFTING_MESSAGES = [
  "Sketching the first lines…",
  "Mixing the perfect palette…",
  "Capturing your pet's personality…",
  "Adding brushstrokes of character…",
  "Bringing your artwork to life…",
];
