import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'dotenv';

// Entorno de la suite de integración. Lo comparten global-setup.ts (crea y
// migra la DB) y env.ts (fija process.env en cada worker antes de importar
// AppModule).

export const SHOPIFY_TEST_SECRET = 'test-shopify-webhook-secret';

// Postgres: TEST_DATABASE_URL manda (CI). En local se reutilizan usuario,
// clave y host del DATABASE_URL de backend/.env cambiando solo el nombre de la
// base, para no pedir más configuración.
export function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const envPath = path.resolve(__dirname, '../../.env');
  const devUrl = fs.existsSync(envPath)
    ? parse(fs.readFileSync(envPath)).DATABASE_URL
    : undefined;
  if (!devUrl) {
    throw new Error(
      'Integración: define TEST_DATABASE_URL o DATABASE_URL en backend/.env',
    );
  }

  const url = new URL(devUrl);
  url.pathname = '/clawpuzzle_test';
  return url.toString();
}

// Los tests truncan todas las tablas: nunca contra una base que no sea de test.
export function assertTestDatabase(databaseUrl: string): void {
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Integración: la base "${dbName}" no termina en _test; me niego a truncarla`,
    );
  }
}

// DB 15 de Redis: aislada de la 0 que usa el entorno de desarrollo.
export function resolveTestRedisUrl(): string {
  return process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
}
