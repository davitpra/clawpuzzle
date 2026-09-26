// Etiquetas de especie de cara al cliente. El valor que viaja al backend sigue
// en inglés (`dog`, `cat`…); solo cambia lo que se muestra.
export const SPECIES_LABELS: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
  bird: "Ave",
  rabbit: "Conejo",
  other: "Otro",
};

/** Etiqueta de una especie; devuelve el valor tal cual si no está mapeado. */
export function speciesLabel(value?: string | null): string {
  if (!value) return "";
  return SPECIES_LABELS[value.toLowerCase()] ?? value;
}
