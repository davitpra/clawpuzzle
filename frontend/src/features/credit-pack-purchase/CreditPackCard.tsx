"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, type CartItem } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { useCreditPackProduct, type CreditPackOption } from "./useCreditPackProduct";

function formatPrice(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: currency || "USD",
  }).format(n);
}

/**
 * Storefront widget to buy a generation-credit pack. Lists the configured
 * Shopify variants (each mapped to a credit amount), gated behind login: adding
 * to cart requires an authenticated user so the checkout can attach `_user_id`
 * and the webhook credits the right account.
 *
 * En modo lanzamiento `/cart` está bloqueado, así que el pack va directo al
 * checkout de Shopify como línea única (sin arrastrar lo que hubiera en el
 * carrito local, ni dejarlo ahí). Con el flag apagado, sigue pasando por el
 * carrito como el resto de la tienda.
 */
export function CreditPackCard({ className = "" }: { className?: string }) {
  const { product, options, defaultImage, loading, unavailable } =
    useCreditPackProduct();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const { signIn } = useGoogleSignIn();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = async (opt: CreditPackOption) => {
    if (!product) return;
    if (!isAuthenticated) {
      // Google in situ: en lanzamiento /login no existe.
      signIn();
      return;
    }

    const item: CartItem = {
      id: `credits-${opt.variant.id}`,
      variantId: opt.variant.id,
      name: product.title,
      size: `${opt.creditAmount} créditos`,
      price: Number.parseFloat(opt.variant.price.amount) || 0,
      quantity: 1,
      img: defaultImage ?? "",
    };

    if (!LAUNCH_MODE) {
      addToCart(item);
      setAdded(true);
      return;
    }

    // `startCheckout` cierra sobre el carrito del render anterior, así que no
    // vale `addToCart` + `startCheckout()`: se le pasa la línea explícita.
    setError(null);
    const result = await startCheckout([item]);
    if (result.status !== "redirect") {
      setError(
        result.message ??
          "No pudimos iniciar el pago. Inténtalo de nuevo en un momento.",
      );
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl bg-cream px-6 py-8 text-center text-text-muted ${className}`}>
        Cargando paquetes de créditos…
      </div>
    );
  }

  if (unavailable || options.length === 0) {
    return (
      <div className={`rounded-xl bg-cream px-6 py-8 text-center text-text-muted ${className}`}>
        Los paquetes de créditos no están disponibles ahora. Vuelve pronto.
      </div>
    );
  }

  return (
    <div className={`rounded-xl bg-white p-6 ${className}`}>
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <div
            key={opt.variant.id}
            className="flex items-center justify-between rounded-xl border border-[#E0DED9] px-4 py-3"
          >
            <div>
              <p className="font-display font-black text-text-main">
                {opt.creditAmount} créditos
              </p>
              <p className="text-sm text-text-muted">
                {formatPrice(
                  opt.variant.price.amount,
                  opt.variant.price.currencyCode,
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => buy(opt)}
              disabled={isCheckingOut}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                shopping_bag
              </span>
              {isCheckingOut ? "Redirigiendo…" : "Comprar"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-center text-sm font-bold text-red-600">
          {error}
        </p>
      )}

      {/* En modo lanzamiento `added` nunca se pone a true (el pack va directo
          al checkout), así que este enlace al carrito bloqueado no aparece. */}
      {added && (
        <Link
          href="/cart"
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
        >
          <span className="material-symbols-outlined text-[18px]">
            shopping_cart
          </span>
          Ver carrito
        </Link>
      )}

      <p className="mt-4 text-center text-xs text-text-muted">
        Los créditos se suman a tu cuenta un minuto después del pago.
      </p>
    </div>
  );
}
