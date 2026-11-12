// Helpers de medición sin React. Todos son no-op si falta el ID o si
// `window.fbq` / `window.gtag` no existen (SSR o bloqueador de anuncios), así
// que se pueden llamar desde cualquier sitio sin comprobar nada antes.
import { GA_MEASUREMENT_ID, META_PIXEL_ID } from "@/shared/config/analytics";

type Params = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function fbq(...args: unknown[]) {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  window.fbq?.(...args);
}

function gtag(...args: unknown[]) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  window.gtag?.(...args);
}

/** El admin no se mide: ni `/admin/*` ni `/admin-login`. */
export function isTrackedPath(path: string): boolean {
  return !path.startsWith("/admin");
}

/**
 * `firstLoad`: la vista de la carga completa. GA4 ya la manda solo con el
 * `config` de `AnalyticsScripts` (con la URL y los UTM), así que solo va a Meta.
 */
export function trackPageView(
  path: string,
  { firstLoad = false }: { firstLoad?: boolean } = {},
) {
  if (!isTrackedPath(path)) return;
  fbq("track", "PageView");
  if (firstLoad) return;
  // `page_location` con la URL completa: así GA4 lee los UTM del anuncio.
  gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export interface TrackEventInput {
  /** `custom: true` → `fbq('trackCustom', …)` (eventos no estándar de Meta). */
  meta?: { name: string; params?: Params; custom?: boolean };
  ga?: { name: string; params?: Params };
}

export function trackEvent({ meta, ga }: TrackEventInput) {
  if (meta) {
    fbq(meta.custom ? "trackCustom" : "track", meta.name, meta.params ?? {});
  }
  if (ga) gtag("event", ga.name, ga.params ?? {});
}

/**
 * Coincidencia avanzada de Meta: el píxel hashea el email en SHA-256 antes de
 * enviarlo. A GA4 solo va el id: prohíbe datos personales como el email.
 */
export function identifyUser({
  id,
  email,
}: {
  id: string;
  /** null para un invitado: su email es sintético y no sirve para coincidir. */
  email: string | null;
}) {
  fbq("init", META_PIXEL_ID, {
    ...(email ? { em: email.trim().toLowerCase() } : {}),
    external_id: id,
  });
  gtag("set", { user_id: id });
}

/**
 * Al cerrar sesión. El píxel de Meta no permite borrar los datos de
 * coincidencia de la página actual; se descartan al recargar.
 */
export function clearUser() {
  gtag("set", { user_id: null });
}

// Evento del login (`sign_up`/`login`) en espera. `AuthContext` lo deja aquí
// en vez de mandarlo directamente: así sale justo después de `identifyUser`
// (lo vacía `AnalyticsIdentity`) y Meta lo recibe con email y external_id.
let pendingAuthEvent: TrackEventInput | null = null;

export function queueAuthEvent(input: TrackEventInput) {
  pendingAuthEvent = input;
}

export function flushAuthEvent() {
  const input = pendingAuthEvent;
  pendingAuthEvent = null;
  if (input) trackEvent(input);
}

/** Lo que espera `trackBeforeLeaving` para que el píxel de Meta alcance a salir. */
export const LEAVE_DELAY_MS = 300;

/**
 * Para eventos justo antes de salir del sitio (checkout de Shopify): GA4 va
 * por beacon, pero el píxel de Meta necesita unos ms antes de que la página se
 * descargue. Sin píxel cargado no espera nada.
 */
export async function trackBeforeLeaving(input: TrackEventInput) {
  trackEvent(input);
  if (!input.meta || !META_PIXEL_ID || typeof window === "undefined" || !window.fbq) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, LEAVE_DELAY_MS));
}
