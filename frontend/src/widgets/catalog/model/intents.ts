import { CatalogProduct } from "./types";

// Familias de producto en el orden en que aparecen en la primera fila de la
// barra del catálogo. Es un eje derivado: ningún campo lo trae hecho.
//
// ClawAndSoul tenía cuatro familias porque cruzaba dos ejes (`artKind` para el
// contenido, `productType` para el formato). ClawPuzzle vende un producto
// físico y créditos, así que las familias son esas dos.
export const CATALOG_INTENTS = [
  { key: "puzzle", title: "Puzzles" },
  { key: "credits", title: "Credits" },
] as const;

// Familia preseleccionada al entrar: el rompecabezas es el producto principal.
export const DEFAULT_CATALOG_INTENT: string = "puzzle";

/**
 * Familia a la que pertenece un producto, o "" si no encaja en ninguna (un
 * producto sin template asignado en el admin). Esos productos siguen siendo
 * alcanzables desde el chip "All", que no filtra por familia.
 */
export function productIntent(product: CatalogProduct): string {
  if (product.isCreditPack || product.productType === "Credits") {
    return "credits";
  }
  if (product.template === "Puzzle" || product.productType === "Puzzle") {
    return "puzzle";
  }
  return "";
}
