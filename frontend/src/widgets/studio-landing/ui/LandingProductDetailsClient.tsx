"use client";

import { useState } from "react";
import type { ShopifyProduct } from "@/lib/shopify";
import ProductDetails from "@/widgets/product-details/ui/ProductDetails";
import type { StyleChoice } from "@/entities/product/ui/ProductStyleSelector";
import { normalizeTemplate } from "@/entities/product/lib/template";
import { toFrameStyle } from "@/entities/product/lib/frameStyle";

interface LandingProductDetailsClientProps {
  product: ShopifyProduct;
  template: string | null;
  styles: StyleChoice[];
}

/** El estado de la ficha, el mismo que tiene `app/product/[handle]/page.tsx`. */
export default function LandingProductDetailsClient({
  product,
  template,
  styles,
}: LandingProductDetailsClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants.edges[0]?.node.id ?? "",
  );
  const [mainImage, setMainImage] = useState(
    product.images.edges[0]?.node.url ?? "",
  );
  const normalized = normalizeTemplate(template);

  return (
    <ProductDetails
      product={product}
      selectedVariantId={selectedVariantId}
      setSelectedVariantId={setSelectedVariantId}
      mainImage={mainImage}
      setMainImage={setMainImage}
      frameStyle={toFrameStyle(normalized)}
      template={normalized}
      styleChoices={styles}
      showBreadcrumb={false}
    />
  );
}
