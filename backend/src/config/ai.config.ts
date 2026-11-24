import { registerAs } from '@nestjs/config';

/** Generaciones simultáneas si `IMAGE_GENERATION_CONCURRENCY` no se define. */
export const DEFAULT_GENERATION_CONCURRENCY = 3;
const MAX_GENERATION_CONCURRENCY = 10;

/**
 * Cuántas generaciones procesa a la vez el worker de `image-generation`. BullMQ
 * procesa de a 1 si no se le dice nada, y eso ponía en fila a todos los
 * clientes (y a los retratos de un mismo bundle). El techo lo ponen los límites
 * de fal.ai (OpenRouter va a través de fal) y la memoria de la instancia.
 * Valores no numéricos o fuera de 1–10 caen al valor por defecto o al tope.
 */
export function parseGenerationConcurrency(value: string | undefined): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_GENERATION_CONCURRENCY;
  return Math.min(n, MAX_GENERATION_CONCURRENCY);
}

export default registerAs('ai', () => ({
  falKey: process.env.FAL_KEY || '',
  openRouterDefaultModel:
    process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash',
  mock: process.env.MOCK_AI === 'true',
  generationConcurrency: parseGenerationConcurrency(
    process.env.IMAGE_GENERATION_CONCURRENCY,
  ),
}));
