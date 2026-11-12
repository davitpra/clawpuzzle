import * as fs from "node:fs";
import { GUEST_IDS_FILE, SESSION_FILE, runSessionScript } from "./session";

export default function globalTeardown(): void {
  const guestIds = fs.existsSync(GUEST_IDS_FILE)
    ? fs.readFileSync(GUEST_IDS_FILE, "utf8").split("\n").filter(Boolean)
    : [];
  runSessionScript("cleanup", guestIds);
  fs.rmSync(SESSION_FILE, { force: true });
  fs.rmSync(GUEST_IDS_FILE, { force: true });
}
