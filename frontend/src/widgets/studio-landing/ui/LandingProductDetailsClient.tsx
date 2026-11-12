"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShopifyProduct } from "@/lib/shopify";
import ProductDetails from "@/widgets/product-details/ui/ProductDetails";
import { normalizeTemplate } from "@/entities/product/lib/template";
import { toFrameStyle } from "@/entities/product/lib/frameStyle";
import { isDogVariant } from "@/entities/product/lib/variantOptions";
import { trackEvent } from "@/shared/lib/analytics/track";
import {
  selectThemeEvent,
  viewContentEvent,
} from "@/shared/lib/analytics/events";
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

  const findVariant = useCallback(
    (id: string) => product.variants.edges.find((v) => v.node.id === id)?.node,
    [product],
  );

  // ViewContent / view_item, una vez por producto (el ref evita el doble
  // efecto de StrictMode).
  const viewedProductId = useRef<string | null>(null);
  useEffect(() => {
    if (viewedProductId.current === product.id) return;
    viewedProductId.current = product.id;
    const firstId = product.variants.edges[0]?.node.id ?? "";
    trackEvent(viewContentEvent(product, findVariant(firstId)));
  }, [product, findVariant]);

  // SelectTheme / select_item solo cuando el visitante cambia la variante.
  // `ProductDetails` llama a este mismo setter al cargar los formatos (elige
  // el primero personalizable); esa llamada no viene de una interacción, así
  // que se ignora hasta el primer click/tecla dentro de la ficha.
  const userInteracted = useRef(false);
  const markInteraction = useCallback(() => {
    userInteracted.current = true;
  }, []);
  const selectVariant = useCallback(
    (id: string) => {
      if (userInteracted.current && id !== selectedVariantId) {
        trackEvent(selectThemeEvent(product, findVariant(id)));
      }
      setSelectedVariantId(id);
    },
    [product, findVariant, selectedVariantId],
  );

  return (
    // `contents`: el div no cuenta para el layout; solo escucha interacciones.
    <div
      className="contents"
      onPointerDownCapture={markInteraction}
      onKeyDownCapture={markInteraction}
    >
      <ProductDetails
        product={product}
        selectedVariantId={selectedVariantId}
        setSelectedVariantId={selectVariant}
        mainImage={mainImage}
        setMainImage={setMainImage}
        frameStyle={toFrameStyle(normalized)}
        template={normalized}
        styleSelectable
        showBreadcrumb={false}
      />
    </div>
  );
}
