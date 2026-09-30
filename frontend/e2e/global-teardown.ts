import * as fs from "node:fs";
import { SESSION_FILE, runSessionScript } from "./session";

export default function globalTeardown(): void {
  runSessionScript("cleanup");
  fs.rmSync(SESSION_FILE, { force: true });
}
