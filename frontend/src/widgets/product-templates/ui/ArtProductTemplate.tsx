"use client";

import ProductDetails from "@/widgets/product-details/ui/ProductDetails";
import { StyleShowcase, useStyleCollection } from "@/widgets/collection";
import ProductFAQ from "@/widgets/product-faq/ui/ProductFAQ";
import { ProductTemplateProps } from "./ProductPageTemplate";
import { getSimilarProducts } from "@/entities/product/lib/getSimilarProducts";
import {
  ExpandingGallery,
  sameStyleGalleryTitle,
  useSameStyleItems,
} from "@/widgets/expanding-gallery";
import { SimilarSouls } from "@/widgets/similar-souls";
import { AIProcess } from "@/widgets/ai-process";
import SectionFlow from "@/shared/ui/SectionFlow";
import { PRODUCT_PROCESS_STEPS } from "../model/processSteps";

/**
 * Storefront template del rompecabezas: ficha + este orden de secciones.
 *
 * ClawAndSoul ramificaba aquí por dos ejes (`template` × `artKind`) porque
 * vendía tres formatos de entrega con dos tipos de contenido. ClawPuzzle vende
 * un solo producto físico, así que no queda nada que ramificar: la página es
 * la misma siempre.
 */
export default function ArtProductTemplate({
  product,
  selectedVariantId,
  setSelectedVariantId,
  mainImage,
  setMainImage,
  handle,
  faqs,
  frameStyle,
  template,
}: ProductTemplateProps) {
  const similarProducts = getSimilarProducts(product);
  const processSteps = PRODUCT_PROCESS_STEPS;

  // Los datos de estas dos secciones se resuelven acá y no dentro de su widget:
  // SectionFlow necesita saber cuáles van a tener contenido antes de repartir
  // los fondos, o la alternancia queda corrida y sobra un divisor.
  const styleCollection = useStyleCollection(handle);
  const {
    items: sameStyleItems,
    styleName,
  } = useSameStyleItems(handle);

  return (
    <>
      <div className="flex justify-center py-6 md:py-10 px-4 md:px-10 lg:px-40">
        <div className=" max-w-300 w-full gap-8">
          <ProductDetails
            product={product}
            selectedVariantId={selectedVariantId}
            setSelectedVariantId={setSelectedVariantId}
            mainImage={mainImage}
            setMainImage={setMainImage}
            frameStyle={frameStyle}
            template={template}
          />
        </div>
      </div>

      <SectionFlow
        start="white"
        sections={[
          {
            id: "styles",
            when: styleCollection.hasContent,
            node: (
              <StyleShowcase
                collection={styleCollection}
                frameStyle={frameStyle}
              />
            ),
          },
          {
            id: "process",
            node: (
              <AIProcess
                eyebrow="Cómo funciona"
                // Derivado de los pasos: el coloreable suma un cuarto y el copy
                // no puede quedarse en "3".
                title={`Tu rompecabezas personalizado en ${processSteps.length} pasos`}
                subtitle={
                  <>
                    Mira a tu mascota convertida en arte en segundos.
                    <br />
                    La vista previa es gratis.
                  </>
                }
                steps={processSteps}
              />
            ),
          },
          {
            id: "gallery",
            when: sameStyleItems.length > 0,
            node: (
              <ExpandingGallery
                eyebrow={styleName ?? "Mismo estilo"}
                title={sameStyleGalleryTitle()}
                items={sameStyleItems}
                background=""
              />
            ),
          },
          {
            id: "similar",
            when: similarProducts.length > 0,
            node: <SimilarSouls products={similarProducts} />,
          },
          {
            id: "faq",
            node: <ProductFAQ faqs={faqs} background="" />,
          },
        ]}
      />
    </>
  );
}
