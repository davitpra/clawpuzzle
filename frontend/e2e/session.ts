import { execFileSync } from "node:child_process";
import * as path from "node:path";

// Puente con backend/scripts/e2e-session.ts: crea (o borra) el usuario de
// prueba en la base de desarrollo y devuelve sus tokens.
const BACKEND_DIR = path.resolve(__dirname, "../../backend");

export interface E2ESession {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export const SESSION_FILE = path.resolve(
  __dirname,
  "../test-results/.e2e-session.json",
);

// Invitados que crean los tests sin sesión (uno por línea): el teardown los
// borra junto al usuario sembrado.
export const GUEST_IDS_FILE = path.resolve(
  __dirname,
  "../test-results/.e2e-guests.txt",
);

export function runSessionScript(
  command: "create" | "cleanup",
  args: string[] = [],
): string {
  return execFileSync(
    "npx",
    ["ts-node", "--transpile-only", "scripts/e2e-session.ts", command, ...args],
    {
      cwd: BACKEND_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
}
