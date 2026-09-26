/**
 * Frases de espera que rotan mientras la IA genera el arte (estilo status ticker).
 *
 * Const a nivel de módulo → referencia estable para `useRotatingMessage`, y una
 * sola lista compartida por `IAThanksStep` (flujo clásico) e `IAGeneratingStep`
 * (flujo de lanzamiento).
 */
export const CRAFTING_MESSAGES = [
  "Trazando las primeras líneas…",
  "Eligiendo los colores perfectos…",
  "Capturando la personalidad de tu mascota…",
  "Cuidando cada detalle…",
  "Preparando cada pieza…",
];
