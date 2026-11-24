"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import { useAuth } from "@/context/AuthContext";
import StickyPersonalizeBar from "./StickyPersonalizeBar";
import { bundlePrice } from "@/entities/product/lib/bundle";

interface PersonalizeButtonProps {
  product: ShopifyProduct;
  selectedVariant: ShopifyVariant | undefined;
  productRefId?: string;
  styleId?: string;
  formatId?: string;
  isCompatLoading?: boolean;
  hasBackendMapping?: boolean;
  backendError?: string | null;
  userSelections?: Record<string, string | number>;
  /** El estilo se elige después, en el paso de estilo de `/create`. */
  styleOptional?: boolean;
  /** Muestra la barra fija abajo con el CTA cuando el botón queda atrás. */
  stickyBar?: boolean;
  /** Cantidad del bundle preseleccionada; viaja a `/create` como `qty`. */
  bundleQuantity?: number;
}

export default function PersonalizeButton({
  product,
  selectedVariant,
  productRefId,
  styleId,
  formatId,
  isCompatLoading = false,
  hasBackendMapping = false,
  backendError = null,
  userSelections,
  styleOptional = false,
  stickyBar = false,
  bundleQuantity = 1,
}: PersonalizeButtonProps) {
  // Callback ref en estado: si el botón se re-monta, la barra observa el nodo nuevo.
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);
  const missingStyle = !styleId && !styleOptional;

  const router = useRouter();

  const isDisabled =
    !selectedVariant ||
    isCompatLoading ||
    !!backendError ||
    !hasBackendMapping ||
    // Sin estilo asignado el generador no tiene qué producir: se bloquea aquí
    // en vez de dejar que la ruta /create reciba un contexto incompleto.
    missingStyle ||
    !formatId;

  const handlePersonalize = () => {
    if (!product || !selectedVariant || isDisabled) return;

    const params = new URLSearchParams();
    if (productRefId) params.set("product_ref_id", productRefId);
    if (formatId) params.set("format_id", formatId);
    // El tema (Perro | Gato) es una variante del mismo formato: sin su id,
    // `/create` cobraría la primera variante del formato.
    params.set("variant_id", selectedVariant.id);
    if (styleId) params.set("style_id", styleId);
    if (userSelections && Object.keys(userSelections).length > 0) {
      params.set("selections", JSON.stringify(userSelections));
    }
    if (bundleQuantity > 1) params.set("qty", String(bundleQuantity));
    const query = params.toString();
    router.push(`/create${query ? `?${query}` : ""}`);
  };

  // Sin sesión la primera vista previa es gratis (crédito de invitado): el CTA
  // lo dice. Con sesión cada vista previa usa 1 crédito, así que no se promete.
  // Mientras se resuelve la sesión gana "gratis": el tráfico llega sin sesión.
  const { hasSession, isLoading: isAuthLoading } = useAuth();
  const readyLabel =
    !isAuthLoading && hasSession ? "Crear mi rompecabezas" : "Pruébalo gratis";

  const label = isCompatLoading
    ? "Cargando opciones…"
    : backendError
      ? "No disponible para personalizar"
      : !hasBackendMapping || missingStyle
        ? "No disponible para personalizar"
        : !selectedVariant
          ? "Elige una opción"
          : !formatId
            ? "Esta opción aún no se puede personalizar"
            : readyLabel;

  return (
    <div className="flex flex-col gap-3">
      <button
        ref={stickyBar ? setButtonEl : undefined}
        onClick={handlePersonalize}
        disabled={isDisabled}
        className="w-full h-14 bg-primary text-white rounded-full font-bold text-lg hover:bg-primary-dark hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        <span className="material-symbols-outlined">auto_fix_high</span>
        {label}
      </button>
      {backendError && (
        <p className="text-sm text-red-600 text-center">{backendError}</p>
      )}
      {stickyBar && (
        <StickyPersonalizeBar
          anchor={buttonEl}
          product={product}
          selectedVariant={selectedVariant}
          label={label}
          disabled={isDisabled}
          onClick={handlePersonalize}
          bundleQuantity={bundleQuantity}
          bundleTotal={
            selectedVariant
              ? bundlePrice(
                  parseFloat(selectedVariant.price.amount),
                  bundleQuantity,
                ).total
              : undefined
          }
        />
      )}
    </div>
  );
}
