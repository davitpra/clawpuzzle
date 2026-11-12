/**
 * Site key de Cloudflare Turnstile para la sesión de invitado (imagen gratis
 * sin login). Vacía = sin captcha: en desarrollo y e2e, o con el backend sin
 * `TURNSTILE_SECRET_KEY`. Si el backend exige captcha y aquí falta, la sesión
 * de invitado falla y `/create` cae al paso de cuenta.
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
