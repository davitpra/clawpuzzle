// Sesiones de invitado: la primera imagen gratis sin login.

import { registerAs } from '@nestjs/config';

function intFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isInteger(raw) && raw >= 0 ? raw : fallback;
}

// Claves de prueba de Cloudflare Turnstile (`1x0000…AA` siempre aprueba, `2x…`
// siempre falla, etc.). Sirven para desarrollo: en producción anularían el
// captcha y cualquier bot abriría sesiones de invitado con imagen gratis.
const TURNSTILE_TEST_KEY = /^\dx0{10,}/;

function turnstileSecretFromEnv(): string {
  const value = process.env.TURNSTILE_SECRET_KEY ?? '';
  if (process.env.NODE_ENV === 'production' && TURNSTILE_TEST_KEY.test(value)) {
    throw new Error(
      'TURNSTILE_SECRET_KEY is a Cloudflare test key; use the real secret in production',
    );
  }
  return value;
}

export default registerAs('guest', () => ({
  // Interruptor. Apagado por defecto: el backend se puede desplegar antes que el
  // frontend, y un entorno sin configurar no regala generaciones.
  enabled: process.env.GUEST_GENERATION_ENABLED === 'true',
  // Máximo de sesiones de invitado nuevas en las últimas 24 h (todas las IPs).
  // Acota el gasto en fal.ai/OpenRouter si el captcha o el rate limit fallan.
  dailyCap: intFromEnv('GUEST_DAILY_CAP', 200),
  // Días que se conserva un invitado sin pedidos antes de borrarlo con sus
  // fotos y su arte. 0 desactiva la purga.
  retentionDays: intFromEnv('GUEST_RETENTION_DAYS', 30),
  // Vida del refresh token de un invitado. Más larga que la de una cuenta
  // (7 días): perder la sesión es perder la imagen.
  sessionDays: intFromEnv('GUEST_SESSION_DAYS', 30),
  // Cloudflare Turnstile. Vacío = no se verifica (desarrollo y tests).
  turnstileSecret: turnstileSecretFromEnv(),
}));
