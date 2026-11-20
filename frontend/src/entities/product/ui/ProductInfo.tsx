"use client";

import { useState, type ReactNode } from "react";
import { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import { templateLabel } from "@/entities/product/lib/template";
import ProductSpecs from "@/entities/product/ui/ProductSpecs";

/**
 * Esquema de pago: anticipo del 70% al pedir (pago manual registrado en
 * Shopify) y el 30% en efectivo al recibir. Debe coincidir con la sección
 * "Pagos" de /shipping-returns.
 */
const DEPOSIT_RATE = 0.7;

/** "56.00" → "56"; "55.30" → "55.30". */
const formatAmount = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2);

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

  const currencySymbol =
    price?.currencyCode === "USD" || "CAD" ? "$" : price?.currencyCode;

  const priceAmount = price ? parseFloat(price.amount).toFixed(2) : "";
  const originalAmount = compareAtPrice
    ? parseFloat(compareAtPrice.amount).toFixed(2)
    : "";

  // Se redondea el anticipo a centavos y el saldo es la diferencia, para que
  // ambos sumen exactamente el precio.
  const priceValue = price ? parseFloat(price.amount) : 0;
  const depositValue = Math.round(priceValue * DEPOSIT_RATE * 100) / 100;
  const balanceValue = Math.round((priceValue - depositValue) * 100) / 100;

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
          <span className="self-center bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-md">
            Ahorra {discount}%
          </span>
        )}
      </div>
      {/* Los packs de créditos se pagan completos: no llevan anticipo. */}
      {priceValue > 0 && template !== "Credits" && (
        <div className="-mt-2 flex items-center gap-3 rounded-xl bg-text-main/5 px-4 py-3">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[20px] text-text-main"
          >
            account_balance_wallet
          </span>
          <p className="font-body text-sm text-text-muted">
            Paga{" "}
            <span className="font-bold text-text-main">
              {currencySymbol}
              {formatAmount(depositValue)}
            </span>{" "}
            (70%) para empezar y{" "}
            <span className="font-bold text-text-main">
              {currencySymbol}
              {formatAmount(balanceValue)}
            </span>{" "}
            (30%) en efectivo contra entrega
          </p>
        </div>
      )}

      <ProductSpecs product={product} />
    </div>
  );
}
