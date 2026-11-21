// Eventos del embudo (TRACKING.md, paso 4b): construyen el `TrackEventInput`
// de cada momento. Funciones puras para poder probar los nombres y parámetros
// sin montar React; los componentes solo hacen `trackEvent(xxxEvent(...))`.
import type { CartItem } from "@/context/CartContext";
import type { ShopifyProduct, ShopifyVariant } from "@/lib/shopify/types";
import { isDogVariant } from "@/entities/product/lib/variantOptions";
import type { TrackEventInput } from "./track";

const CURRENCY = "USD";

function priceOf(variant: ShopifyVariant | undefined) {
  return Number.parseFloat(variant?.price.amount ?? "") || 0;
}

export function themeOf(variant: ShopifyVariant | undefined): "Perro" | "Gato" {
  return isDogVariant(variant) ? "Perro" : "Gato";
}

/** Ficha de la landing vista (al montar). */
export function viewContentEvent(
  product: ShopifyProduct,
  variant: ShopifyVariant | undefined,
): TrackEventInput {
  const value = priceOf(variant);
  const currency = variant?.price.currencyCode || CURRENCY;
  return {
    meta: {
      name: "ViewContent",
      params: {
        content_ids: [product.id],
        content_type: "product",
        content_name: product.title,
        value,
        currency,
      },
    },
    ga: {
      name: "view_item",
      params: {
        currency,
        value,
        items: [{ item_id: product.id, item_name: product.title, price: value }],
      },
    },
  };
}

/** El visitante eligió una variante (tema Perro/Gato) en la ficha. */
export function selectThemeEvent(
  product: ShopifyProduct,
  variant: ShopifyVariant | undefined,
): TrackEventInput {
  const theme = themeOf(variant);
  return {
    meta: { name: "SelectTheme", custom: true, params: { theme } },
    ga: {
      name: "select_item",
      params: {
        item_list_name: "tema",
        items: [
          {
            item_id: variant?.id ?? product.id,
            item_name: product.title,
            item_variant: theme,
            price: priceOf(variant),
          },
        ],
      },
    },
  };
}

/** Login con Google. Solo la cuenta nueva cuenta como registro en Meta. */
export function authEvent(isNewUser: boolean): TrackEventInput {
  return isNewUser
    ? {
        meta: { name: "CompleteRegistration", params: { status: true } },
        ga: { name: "sign_up", params: { method: "Google" } },
      }
    : { ga: { name: "login", params: { method: "Google" } } };
}

/**
 * El visitante envió su foto para crear el arte. Es el escalón entre elegir
 * estilo y ver el arte: sin login obligatorio ya no lo marca el registro.
 */
export function uploadPhotoEvent(
  styleName: string | null,
  isGuest: boolean,
  photoCount: number,
): TrackEventInput {
  // `photo_count` mide cuántas fotos (guardadas + nuevas) llegan al modelo:
  // el paso pide 4 y este número dice si la gente las sube.
  const params = {
    style: styleName ?? "",
    is_guest: isGuest,
    photo_count: photoCount,
  };
  return {
    meta: { name: "UploadPhoto", custom: true, params },
    ga: { name: "upload_photo", params },
  };
}

/**
 * La vista previa del arte IA está lista. `is_guest` separa la imagen gratis
 * sin login de las generaciones de una cuenta.
 */
export function generateArtEvent(
  generationId: string,
  styleName: string | null,
  isGuest = false,
): TrackEventInput {
  const params = {
    generation_id: generationId,
    style: styleName ?? "",
    is_guest: isGuest,
  };
  return {
    meta: { name: "GenerateArt", custom: true, params },
    ga: { name: "generate_art", params },
  };
}

/**
 * Salida al checkout de Shopify. Solo las líneas con `variantId`: las demás
 * las descarta `buildCheckoutLines` y no llegan a Shopify.
 */
export function checkoutEvent(
  items: CartItem[],
  isGuest = false,
): TrackEventInput {
  const lines = items.filter((item) => item.variantId);
  const value = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    meta: {
      name: "InitiateCheckout",
      params: {
        value,
        currency: CURRENCY,
        num_items: lines.reduce((n, item) => n + item.quantity, 0),
        content_ids: lines.map((item) => item.variantId),
        content_type: "product",
        is_guest: isGuest,
      },
    },
    ga: {
      name: "begin_checkout",
      params: {
        currency: CURRENCY,
        value,
        // La página se va a Shopify justo después: beacon para que salga.
        transport_type: "beacon",
        is_guest: isGuest,
        items: lines.map((item) => ({
          item_id: item.variantId,
          item_name: item.name,
          item_variant: item.style,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    },
  };
}
