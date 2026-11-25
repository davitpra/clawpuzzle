"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import { useAuth } from "@/context/AuthContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { GoogleLogo } from "@/shared/ui/GoogleLogo";
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
  const { hasSession, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Un pedido de 2 o 3 necesita una vista previa por rompecabezas y el invitado
  // solo tiene una: se entra con Google antes de empezar. `isAuthenticated` es
  // false para el invitado, así que uno que ya existe también se convierte en
  // cuenta (con su arte). Tras entrar se sigue a `/create` con la cantidad.
  const needsGoogle = bundleQuantity > 1 && !isAuthLoading && !isAuthenticated;
  const { signIn, pending: signingIn } = useGoogleSignIn({
    onDone: handlePersonalize,
  });
  const handleClick = () => {
    if (isDisabled) return;
    // El popup tiene que abrirse en el mismo click o el navegador lo bloquea.
    if (needsGoogle) signIn();
    else handlePersonalize();
  };

  const readyLabel = needsGoogle
    ? signingIn
      ? "Abriendo Google…"
      : // "registrándote" no cabe en una línea (la columna mide ~360 px
        // también en escritorio); lo dice la nota bajo el botón.
        "Prueba gratis con Google"
    : !isAuthLoading && hasSession
      ? "Crear mi rompecabezas"
      : "Pruébalo gratis";

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
        onClick={handleClick}
        disabled={isDisabled || signingIn}
        aria-busy={signingIn}
        className="w-full h-14 bg-primary text-white rounded-full font-bold text-lg hover:bg-primary-dark hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {needsGoogle ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white">
            <GoogleLogo className="h-4 w-4" />
          </span>
        ) : (
          <span className="material-symbols-outlined">auto_fix_high</span>
        )}
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
          // La barra tiene poco ancho junto a la miniatura y el precio.
          // La "G" ya dice que es con Google.
          label={needsGoogle && !signingIn ? "Pruébalo gratis" : label}
          googleIcon={needsGoogle}
          disabled={isDisabled || signingIn}
          onClick={handleClick}
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
