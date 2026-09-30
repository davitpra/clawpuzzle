import {
  SHOPIFY_TEST_SECRET,
  assertTestDatabase,
  resolveTestDatabaseUrl,
  resolveTestRedisUrl,
} from './test-env';

// setupFiles: corre antes de que cada spec importe AppModule. ConfigModule no
// pisa variables ya presentes en process.env, así que estas ganan a backend/.env.
const databaseUrl = resolveTestDatabaseUrl();
assertTestDatabase(databaseUrl);

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  REDIS_URL: resolveTestRedisUrl(),
  MOCK_AI: 'true',
  SHOPIFY_WEBHOOK_SECRET: SHOPIFY_TEST_SECRET,
  // Sin URL pública no se registran webhooks en Shopify al arrancar.
  APP_PUBLIC_URL: '',
  SHOPIFY_ADMIN_API_URL: '',
  SHOPIFY_ADMIN_API_TOKEN: '',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  COOKIE_DOMAIN: '',
  COOKIE_SAMESITE: 'lax',
  ACCOUNT_LIFECYCLE_ENABLED: 'false',
});
