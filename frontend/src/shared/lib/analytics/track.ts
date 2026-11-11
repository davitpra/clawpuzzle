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

export function trackPageView(path: string) {
  if (!isTrackedPath(path)) return;
  fbq("track", "PageView");
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
export function identifyUser({ id, email }: { id: string; email: string }) {
  fbq("init", META_PIXEL_ID, {
    em: email.trim().toLowerCase(),
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
