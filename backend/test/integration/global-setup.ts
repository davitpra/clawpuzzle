import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { Client } from 'pg';
import { assertTestDatabase, resolveTestDatabaseUrl } from './test-env';

// Crea la base de test si no existe y le aplica las migraciones. Corre una vez
// por ejecución de la suite, antes de cualquier worker.
export default async function globalSetup(): Promise<void> {
  const databaseUrl = resolveTestDatabaseUrl();
  assertTestDatabase(databaseUrl);

  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, '');
  url.pathname = '/postgres';

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
