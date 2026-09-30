import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Solo lógica pura (TESTING.md, Fase 3): entorno node, sin DOM ni React.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
