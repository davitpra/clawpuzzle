export interface Product {
  name: string;
  desc: string;
  price: string;
  /** Precio comparativo (de lista) ya formateado, para mostrarlo tachado cuando hay oferta. */
  compareAtPrice?: string;
  /** Porcentaje de descuento (entero positivo) cuando el producto está en oferta. */
  discountPercent?: number;
  img: string;
  badge?: string;
  tag?: string;
  hasPlay?: boolean;
  shopifyHandle?: string;
  productRefId?: string;
  label?: string;
  /** Formato de entrega del storefront configurado en el admin (Digital, Canvas, Poster…). */
  template?: string | null;
  /** Dificultad del estilo (easy/medium/challenging). */
  difficulty?: string;
}
