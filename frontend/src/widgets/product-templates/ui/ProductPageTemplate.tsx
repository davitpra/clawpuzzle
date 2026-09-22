"use client";

import { ComponentType } from "react";
import { ShopifyProduct } from "@/lib/shopify";
import ArtProductTemplate from "./ArtProductTemplate";
import CreditsTemplate from "./CreditsTemplate";
import { toFrameStyle } from "@/entities/product/lib/frameStyle";
import { normalizeTemplate } from "@/entities/product/lib/template";
import type { FrameStyle } from "@/entities/product/lib/frameStyle";

export interface ProductTemplateProps {
  product: ShopifyProduct;
  selectedVariantId: string;
  setSelectedVariantId: (id: string) => void;
  mainImage: string;
  setMainImage: (url: string) => void;
  handle: string;
  faqs: { q: string; a: string }[];
  frameStyle: FrameStyle;
  /** Tipo de producto normalizado (Puzzle | Credits), para el label. */
  template: string;
}

// El rompecabezas usa la página de producto completa (ficha + secciones);
// los créditos no entran al flujo de personalización y tienen layout propio.
const TEMPLATE_MAP: Record<string, ComponentType<ProductTemplateProps>> = {
  Puzzle: ArtProductTemplate,
  Credits: CreditsTemplate,
};

export default function ProductPageTemplate({
  templateOverride,
  ...props
}: Omit<ProductTemplateProps, "frameStyle" | "template"> & {
  templateOverride?: string | null;
}) {
  const template = normalizeTemplate(templateOverride);
  const Template = TEMPLATE_MAP[template] ?? ArtProductTemplate;
  return (
    <Template {...props} template={template} frameStyle={toFrameStyle(template)} />
  );
}
