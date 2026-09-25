"use client";

import { ShopifyProduct } from "@/lib/shopify";
import Image from "next/image";
import { Carousel } from "@/shared/ui/Carousel";
import { ImageZoom } from "@/shared/ui/ImageZoom";
import { FRAME_SHADOWS } from "@/entities/product/lib/frameStyle";
import type { FrameStyle } from "@/entities/product/lib/frameStyle";

interface ProductGalleryProps {
  product: ShopifyProduct;
  mainImage: string;
  variantImage?: string | null;
  frameStyle?: FrameStyle;
}

export default function ProductGallery({
  product,
  mainImage,
  variantImage,
  frameStyle = "art",
}: ProductGalleryProps) {
  const primaryImage = variantImage || mainImage;
  // La imagen de la variante va primero; el resto del catálogo de fotos del
  // producto va detrás para que la tira de miniaturas tenga contenido.
  const images = [
    primaryImage,
    ...product.images.edges.map((edge) => edge.node.url),
  ].filter((src): src is string => Boolean(src));
  const uniqueImages = Array.from(new Set(images));

  const imageClassName = `w-full h-auto bg-white transition-all duration-300 ease-out ${FRAME_SHADOWS[frameStyle]}`;
  const sizes = "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px";

  const isCarousel = uniqueImages.length > 1;

  // Las fotos de producto ya traen su propio fondo y escena: se muestran tal
  // cual, sin luz de set ni filtro de temperatura encima.
  const renderImage = (src: string, priority = false) => (
    <ImageZoom zoomSrc={src} alt={product.title}>
      <Image
        src={src}
        alt={product.title}
        width={0}
        height={0}
        sizes={sizes}
        className={imageClassName}
        priority={priority}
      />
    </ImageZoom>
  );

  return (
    <div className="lg:col-span-7 flex flex-col gap-8">
      <div className={`w-full group ${isCarousel ? "" : "p-6 md:p-10"}`}>
        {isCarousel ? (
          <Carousel
            showArrows={false}
            showDots={false}
            autoplayMs={5000}
            loop
            renderThumbs={({ selectedIndex, scrollTo }) => (
              <div className="flex gap-4 px-6 md:px-10">
                {uniqueImages.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => scrollTo(i)}
                    aria-label={`View image ${i + 1}`}
                    aria-current={i === selectedIndex}
                    className={`w-20 md:w-24 shrink-0 aspect-square overflow-hidden rounded-xl bg-white transition-all ${
                      i === selectedIndex
                        ? "ring-2 ring-primary"
                        : "opacity-60 hover:opacity-100 hover:shadow-md"
                    }`}
                  >
                    <Image
                      src={src}
                      alt={`${product.title} thumbnail ${i + 1}`}
                      width={120}
                      height={120}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          >
            {uniqueImages.map((src, i) => (
              <div
                key={src}
                className="flex-[0_0_100%] min-w-0 flex items-center justify-center px-6 md:px-10 pt-6 pb-12"
              >
                {renderImage(src, i === 0)}
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="flex-[0_0_100%] min-w-0 flex items-center justify-center px-6 md:px-10 pt-6 pb-12">
            {renderImage(primaryImage, true)}
          </div>
        )}
      </div>
    </div>
  );
}
