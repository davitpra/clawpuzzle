import { defineConfig, devices } from "@playwright/test";

// Smoke del embudo de lanzamiento contra el stack local (TESTING.md, Fase 3).
// Solo local: usa la base de desarrollo, la Storefront API real de Shopify y
// Cloudinary con las credenciales de backend/.env y frontend/.env.local.
//
// Levanta su propio backend y frontend en puertos aparte (3101/3100) para no
// depender de lo que haya corriendo en 3000/3001, y con MOCK_AI=true. Redis va
// a la DB 14: si el `start:dev` de 3001 (MOCK_AI=false) compartiera la cola,
// su worker podría llevarse el job y gastar créditos reales de fal.ai.
const API_PORT = 3101;
const WEB_PORT = 3100;
export const API_URL = `http://localhost:${API_PORT}/api`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_BUILD = "node_modules/.cache/e2e-dist";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Compila fuera de dist para no pisar un `start:dev` abierto. Dentro de
      // node_modules/ la salida queda fuera de los tsconfig y Node sigue
      // resolviendo las dependencias subiendo hasta backend/node_modules.
      command: `npx tsc -p tsconfig.build.json --outDir ${API_BUILD} --tsBuildInfoFile ${API_BUILD}/tsbuildinfo && node ${API_BUILD}/main`,
      cwd: "../backend",
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        PORT: String(API_PORT),
        MOCK_AI: "true",
        REDIS_URL: "redis://localhost:6379/14",
        FRONTEND_URL: WEB_URL,
        // Sin URL pública no re-registra los webhooks de Shopify al arrancar.
        APP_PUBLIC_URL: "",
        // Imagen gratis sin login, sin captcha (e2e/launch-funnel.spec.ts).
        GUEST_GENERATION_ENABLED: "true",
        TURNSTILE_SECRET_KEY: "",
      },
    },
    {
      // Build + start y no `next dev`: puede convivir con un dev server
      // abierto (Next 16 lo aísla en .next/dev). Deja en .next un build que
      // apunta a la API de e2e: rehaz `next build` antes de un `npm start`.
      command: `npx next build && npx next start --port ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_SITE_URL: WEB_URL,
        NEXT_PUBLIC_LAUNCH_MODE: "true",
        // Vacíos a propósito: Next no pisa una variable ya definida con la de
        // .env.local, así que el build sale sin píxel de Meta ni GA4 y los
        // tests no ensucian los datos de medición (TRACKING.md, paso 7).
        NEXT_PUBLIC_META_PIXEL_ID: "",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      },
    },
  ],
});
