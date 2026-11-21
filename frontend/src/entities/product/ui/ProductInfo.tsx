"use client";

import { useState, type ReactNode } from "react";
import { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import { templateLabel } from "@/entities/product/lib/template";
import ProductSpecs from "@/entities/product/ui/ProductSpecs";
import { DepositSplit } from "@/entities/product/ui/DepositSplit";
import { formatPrice } from "@/entities/product/lib/variantPresentation";

interface ProductInfoProps {
  product: ShopifyProduct;
  selectedVariant: ShopifyVariant | undefined;
  /** Formato de entrega normalizado (Digital | Canvas | Poster…). */
  template?: string;
  /**
   * Selector de variante y CTA. Van justo bajo el título: la vista previa es
   * gratis, así que primero se invita a crear y el precio llega después.
   */
  actions?: ReactNode;
}

export default function ProductInfo({
  product,
  selectedVariant,
  template,
  actions,
}: ProductInfoProps) {
  // Tipo de producto de cara al cliente según el formato. Cae a "Personalized"
  // si no hay nada.
  const typeLabel =
    [templateLabel(template)]
      .filter(Boolean)
      .join(" · ") || "Personalized";
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const price = selectedVariant?.price;
  const compareAtPrice = selectedVariant?.compareAtPrice;

  // Mismo formato que el resto del storefront (es-EC: "$69,99").
  const money = (n: number) => formatPrice(n, price?.currencyCode ?? "USD");

  const priceValue = price ? parseFloat(price.amount) : 0;
  const priceAmount = price ? money(priceValue) : "";
  const originalAmount = compareAtPrice
    ? money(parseFloat(compareAtPrice.amount))
    : "";

  const discount =
    price && compareAtPrice && parseFloat(compareAtPrice.amount) > 0
      ? Math.round(
          ((parseFloat(compareAtPrice.amount) - parseFloat(price.amount)) /
            parseFloat(compareAtPrice.amount)) *
            100,
        )
      : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Title + Availability */}
      <div className="flex flex-col gap-3">
        <span className="hidden lg:block text-primary font-bold tracking-wider uppercase text-sm">
          {typeLabel}
        </span>
        <h1 className="font-display text-3xl lg:text-5xl font-black text-text-main tracking-tight leading-[1.1]">
          {product.title}
        </h1>
      </div>

      {actions}

      {/* Description — click para expandir / colapsar el texto completo */}
      {product.description && (
        <button
          type="button"
          onClick={() => setIsDescriptionExpanded((prev) => !prev)}
          aria-expanded={isDescriptionExpanded}
          className="group text-left cursor-pointer"
        >
          <p
            className={`font-body text-text-muted leading-relaxed whitespace-pre-line ${
              isDescriptionExpanded ? "" : "line-clamp-3"
            }`}
          >
            {product.description}
          </p>
          <span className="mt-1 inline-block font-body text-sm font-bold text-primary group-hover:underline">
            {isDescriptionExpanded ? "Leer menos" : "Leer más"}
          </span>
        </button>
      )}

      <div className="h-px w-full bg-text-main/10"></div>

      {/* Price */}
      <div className="flex items-baseline gap-4">
        <span className="font-display text-4xl font-black text-primary">
          {priceAmount}
        </span>
        {discount > 0 && (
          <span className="text-lg text-text-muted/60 line-through font-medium">
            {originalAmount}
          </span>
        )}
        {discount > 0 && (
          <span className="self-center bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-md">
            Ahorra {discount}%
          </span>
        )}
      </div>
      {/* Los packs de créditos se pagan completos: no llevan anticipo. */}
      {priceValue > 0 && template !== "Credits" && (
        <DepositSplit
          className="-mt-2"
          price={priceValue}
          formatMoney={money}
        />
      )}

      <ProductSpecs product={product} />
    </div>
  );
}
