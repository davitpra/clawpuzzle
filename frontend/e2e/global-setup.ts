import * as fs from "node:fs";
import * as path from "node:path";
import { SESSION_FILE, runSessionScript } from "./session";

export default function globalSetup(): void {
  const json = runSessionScript("create");
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, json);
}
