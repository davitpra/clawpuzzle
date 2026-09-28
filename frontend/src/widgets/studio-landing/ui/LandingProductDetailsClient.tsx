"use client";

import { useEffect, useState } from "react";
import type { ShopifyProduct } from "@/lib/shopify";
import ProductDetails from "@/widgets/product-details/ui/ProductDetails";
import { normalizeTemplate } from "@/entities/product/lib/template";
import { toFrameStyle } from "@/entities/product/lib/frameStyle";
import { isDogVariant } from "@/entities/product/lib/variantOptions";
import { useLandingTheme } from "../model/LandingThemeContext";

interface LandingProductDetailsClientProps {
  product: ShopifyProduct;
  template: string | null;
}

/** El estado de la ficha, el mismo que tiene `app/product/[handle]/page.tsx`. */
export default function LandingProductDetailsClient({
  product,
  template,
}: LandingProductDetailsClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants.edges[0]?.node.id ?? "",
  );
  const [mainImage, setMainImage] = useState(
    product.images.edges[0]?.node.url ?? "",
  );
  const normalized = normalizeTemplate(template);

  // Las cards de estilos cambian de imagen según el tema elegido aquí.
  const { setDogTheme } = useLandingTheme();
  useEffect(() => {
    const variant = product.variants.edges.find(
      (v) => v.node.id === selectedVariantId,
    )?.node;
    setDogTheme(isDogVariant(variant));
  }, [product, selectedVariantId, setDogTheme]);

  return (
    <ProductDetails
      product={product}
      selectedVariantId={selectedVariantId}
      setSelectedVariantId={setSelectedVariantId}
      mainImage={mainImage}
      setMainImage={setMainImage}
      frameStyle={toFrameStyle(normalized)}
      template={normalized}
      styleSelectable
      showBreadcrumb={false}
    />
  );
}
