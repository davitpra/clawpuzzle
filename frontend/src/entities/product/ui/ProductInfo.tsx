"use client";

import { useState } from "react";
import { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import { templateLabel } from "@/entities/product/lib/template";

interface ProductInfoProps {
  product: ShopifyProduct;
  selectedVariant: ShopifyVariant | undefined;
  /** Formato de entrega normalizado (Digital | Canvas | Poster…). */
  template?: string;
  /** Contenido de la obra: "pbn" | "print"; undefined si no está asignado. */
}

export default function ProductInfo({
  product,
  selectedVariant,
  template,
}: ProductInfoProps) {
  // Tipo de producto de cara al cliente: formato + contenido, ej.
  // "Canvas Print · Paint by Numbers". Cae a "Personalized" si no hay nada.
  const typeLabel =
    [templateLabel(template)]
      .filter(Boolean)
      .join(" · ") || "Personalized";
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const price = selectedVariant?.price;
  const compareAtPrice = selectedVariant?.compareAtPrice;

  const currencySymbol =
    price?.currencyCode === "USD" || "CAD" ? "$" : price?.currencyCode;

  const priceAmount = price ? parseFloat(price.amount).toFixed(2) : "";
  const originalAmount = compareAtPrice
    ? parseFloat(compareAtPrice.amount).toFixed(2)
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
        <span className="text-primary font-bold tracking-wider uppercase text-sm">
          {typeLabel}
        </span>
        <h1 className="font-display text-4xl lg:text-5xl font-black text-text-main tracking-tight leading-[1.1]">
          {product.title}
        </h1>
      </div>
      {/* Price */}
      <div className="flex items-baseline gap-4">
        <span className="font-display text-4xl font-black text-primary">
          {currencySymbol}
          {priceAmount}
        </span>
        {discount > 0 && (
          <span className="text-lg text-text-muted/60 line-through font-medium">
            {currencySymbol}
            {originalAmount}
          </span>
        )}
        {discount > 0 && (
          <span className="bg-primary/10 text-primary font-black px-3 py-1.5 rounded-xl uppercase tracking-widest">
            Ahorra {discount}%
          </span>
        )}
      </div>
      {/* Credit Price */}
      <div className="flex items-center gap-2 text-text-muted">
        <span className="material-symbols-outlined text-[20px] text-primary">
          auto_awesome
        </span>
        <span className="font-body">
          Cada vista previa usa{" "}
          <span className="font-bold text-primary">1 crédito</span>
        </span>
      </div>

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
    </div>
  );
}
