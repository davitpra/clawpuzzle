"use client";

import { useState, type ReactNode } from "react";
import { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import { templateLabel } from "@/entities/product/lib/template";
import ProductSpecs from "@/entities/product/ui/ProductSpecs";
import { DepositSplit } from "@/entities/product/ui/DepositSplit";
import { BundlePricing } from "@/entities/product/ui/BundlePricing";
import { bundlePrice, type BundleQuantity } from "@/entities/product/lib/bundle";
import { formatPrice } from "@/entities/product/lib/variantPresentation";
import { splitDeposit } from "@/entities/product/lib/deposit";

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
  /**
   * Cantidad del bundle preseleccionada ("Más mascotas, mejor precio"). Sin
   * `onBundleQuantityChange` la sección no se muestra.
   */
  bundleQuantity?: BundleQuantity;
  onBundleQuantityChange?: (quantity: BundleQuantity) => void;
}

export default function ProductInfo({
  product,
  selectedVariant,
  template,
  actions,
  bundleQuantity = 1,
  onBundleQuantityChange,
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

  // Mismo formato que el resto del storefront (es-EC: "$69,99"), sin ",00" en
  // los montos redondos ("$100", "$21").
  const money = (n: number) =>
    formatPrice(n, price?.currencyCode ?? "USD", { trimZeroCents: true });

  const priceValue = price ? parseFloat(price.amount) : 0;
  const compareAtValue = compareAtPrice ? parseFloat(compareAtPrice.amount) : 0;
  // El ahorro se redondea hacia abajo a dólares enteros ($30,01 → "$30"): nunca
  // prometemos más de lo que se ahorra.
  const savings =
    priceValue > 0 && compareAtValue > priceValue
      ? Math.floor(compareAtValue - priceValue)
      : 0;

  // Los packs de créditos se pagan completos: no llevan anticipo.
  const hasDeposit = priceValue > 0 && template !== "Credits";
  const { balance } = splitDeposit(priceValue);

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

        {/* Precio — bajo el título, antes del CTA */}
        {priceValue > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-display text-3xl lg:text-4xl font-black text-primary">
                {money(priceValue)}
              </span>
              {savings > 0 && (
                <span className="text-lg text-text-muted/60 line-through font-medium">
                  {money(compareAtValue)}
                </span>
              )}
              {savings > 0 && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                  Ahorras {money(savings)}
                </span>
              )}
            </div>
            {hasDeposit && (
              <p className="flex items-center gap-1.5 text-sm text-text-muted">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  local_shipping
                </span>
                Envío gratis · pagas {money(balance)} al recibir
              </p>
            )}
          </div>
        )}
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

      {/* "Cómo pagas" sigue a la cantidad elegida abajo: con 2 muestra el
          anticipo y el saldo de los $119,98. */}
      {hasDeposit && (
        <DepositSplit
          price={bundlePrice(priceValue, bundleQuantity).total}
          quantity={bundleQuantity}
          formatMoney={money}
        />
      )}

      {hasDeposit && onBundleQuantityChange && (
        <BundlePricing
          unitPrice={priceValue}
          value={bundleQuantity}
          onChange={onBundleQuantityChange}
          formatMoney={money}
        />
      )}

      <ProductSpecs product={product} />
    </div>
  );
}
