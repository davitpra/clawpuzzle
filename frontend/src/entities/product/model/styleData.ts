// Producto del backend, del que solo nos interesa su handle de Shopify y su estilo.
export interface BackendProductLite {
  shopifyHandle: string | null;
  /** Producto dedicado a la venta de créditos (único). */
  isCreditPack?: boolean;
  /** Tipo de producto del storefront (Puzzle | Credits). */
  template?: string | null;
  style?: {
    id: string;
    displayName: string;
    category?: string;
    difficulty?: string | null;
  } | null;
}

// Estilos resueltos desde el backend: datos por handle + categoría por estilo.
export interface StyleData {
  /** handle de Shopify → nombre del estilo del producto. */
  byHandle: Map<string, string>;
  /** handle de Shopify → tipo de producto del backend (Puzzle | Credits). */
  templateByHandle: Map<string, string>;
  /** handle de Shopify → dificultad del estilo del producto. */
  difficultyByHandle: Map<string, string>;
  /** handle del producto Credit Pack dedicado (el único marcado en el admin); null si no hay. */
  creditPackHandle: string | null;
  /** nombre del estilo → categoría a la que pertenece. */
  categoryByStyle: Map<string, string>;
}
