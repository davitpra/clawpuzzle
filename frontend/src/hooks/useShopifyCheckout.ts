"use client";

import { useCallback, useRef, useState } from "react";
import posthog from "posthog-js";
import { shopifyFetch, GRAPHQL_QUERIES } from "@/lib/shopify";
import { useCart, type CartItem } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { buildCheckoutLines } from "@/hooks/lib/checkoutLines";
import { checkoutEvent } from "@/shared/lib/analytics/events";
import { trackBeforeLeaving } from "@/shared/lib/analytics/track";

/**
 * Resultado de `startCheckout`. `redirect` significa que ya se está navegando a
 * la URL de checkout de Shopify (el caller no debe hacer nada más). El resto son
 * fallos que cada caller reporta a su manera (alert en /cart, mensaje inline en
 * el generador IA).
 * - `empty`: no hay items que comprar (carrito local vacío, o `source` vacío).
 * - `no-variants`: hay items pero ninguno con `variantId` válido de Shopify.
 * - `error`: `userErrors` de Shopify o excepción de red.
 */
export type CheckoutStatus = "redirect" | "empty" | "no-variants" | "error";

export interface CheckoutResult {
  status: CheckoutStatus;
  message?: string;
}

/**
 * Fuente única del flujo de checkout de Shopify, compartida por la página de
 * carrito (`/cart`) y la pantalla de agradecimiento del generador IA. Arma las
 * líneas del carrito (con los attributes que lee el webhook de órdenes:
 * `_user_id`, `_generation_id`, `_image_url`, etc.), crea el carrito en Shopify,
 * vacía nuestro carrito local y redirige a la URL de checkout.
 *
 * `startCheckout` admite una lista de items explícita para vender algo sin
 * pasar por el carrito local (modo lanzamiento: packs de crédito en
 * `/credits`, y la oferta de canvas de §7.3). En ese caso no se toca ni se
 * vacía el carrito local, y los attributes se calculan igual, así que el
 * webhook de órdenes no nota la diferencia.
 */
export function useShopifyCheckout() {
  const { items, clearCart } = useCart();
  const { user, isGuest } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkoutInFlight = useRef(false);

  // Líneas con los attributes que lee el webhook de órdenes: ver
  // `buildCheckoutLines`. El invitado también manda su `_user_id`: es lo que
  // permite al webhook enlazar su arte y, si compra con el email de una cuenta
  // existente, fusionarlo con ella.
  const buildLines = useCallback(
    (source: CartItem[] = items) => buildCheckoutLines(source, user?.id ?? null),
    [items, user],
  );

  const startCheckout = useCallback(
    async (source?: CartItem[]): Promise<CheckoutResult> => {
      const cartItems = source ?? items;
      if (cartItems.length === 0) return { status: "empty" };
      if (checkoutInFlight.current) {
        return { status: "error", message: "Checkout is already starting." };
      }

      checkoutInFlight.current = true;
      setIsCheckingOut(true);
      try {
        const lines = buildLines(cartItems);

        if (lines.length === 0) {
          checkoutInFlight.current = false;
          setIsCheckingOut(false);
          return { status: "no-variants" };
        }

        const response = await shopifyFetch<{
          cartCreate: {
            cart: { checkoutUrl: string };
            userErrors: { field?: string[]; message: string }[];
          };
        }>({
          query: GRAPHQL_QUERIES.CREATE_CART,
          variables: {
            input: {
              lines: lines,
            },
          },
        });

        const { cart, userErrors } = response.data.cartCreate;

        if (userErrors && userErrors.length > 0) {
          console.error("Shopify checkout errors:", userErrors);
          checkoutInFlight.current = false;
          setIsCheckingOut(false);
          return { status: "error", message: userErrors[0].message };
        }

        if (cart?.checkoutUrl) {
          // Shopify cart created — empty our cart before handing off to
          // checkout. Con `source` explícito no se ha vendido el carrito
          // local, así que se deja intacto.
          if (!source) await clearCart();
          posthog.capture("checkout_started", {
            checkout_source: source ? "direct" : "cart",
            is_guest: isGuest,
            item_count: lines.length,
            cart_value: cartItems.reduce(
              (total, item) => total + item.price * item.quantity,
              0,
            ),
          });
          // InitiateCheckout / begin_checkout. Espera ~300 ms (solo con el
          // píxel cargado) para que Meta lo reciba antes de salir del sitio.
          await trackBeforeLeaving(checkoutEvent(cartItems, isGuest));
          window.location.href = cart.checkoutUrl;
          return { status: "redirect" };
        }

        checkoutInFlight.current = false;
        setIsCheckingOut(false);
        return { status: "error" };
      } catch (error) {
        console.error("Checkout failed:", error);
        checkoutInFlight.current = false;
        setIsCheckingOut(false);
        return { status: "error" };
      }
    },
    [items, buildLines, clearCart, isGuest],
  );

  return { startCheckout, buildLines, isCheckingOut };
}
