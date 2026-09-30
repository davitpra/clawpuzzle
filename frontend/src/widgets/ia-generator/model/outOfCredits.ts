import { ApiError } from "@/lib/auth/fetch-with-refresh";

/**
 * ¿El fallo fue el 402 de saldo agotado de `POST /generations`? Habilita el CTA
 * a /credits. Se decide por el status, nunca por el texto: el mensaje del
 * backend puede cambiar (o traducirse) sin que deje de ser un 402.
 */
export function isOutOfCreditsError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}
