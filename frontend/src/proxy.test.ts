import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// LAUNCH_MODE es una constante de build (NEXT_PUBLIC_*); el mock la expone
// con un getter para poder probar ambos modos en el mismo fichero.
const flags = vi.hoisted(() => ({ launch: true }));
vi.mock("@/shared/config/launch", () => ({
  get LAUNCH_MODE() {
    return flags.launch;
  },
}));

import { proxy } from "./proxy";

const ORIGIN = "https://clawpuzzle.com";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.firma`;
}

function run(path: string, accessToken?: string) {
  const req = new NextRequest(`${ORIGIN}${path}`);
  if (accessToken) req.cookies.set("accessToken", accessToken);
  return proxy(req);
}

const location = (res: Response) => res.headers.get("location");
// NextResponse.next() no redirige: lo marca con esta cabecera.
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy — modo lanzamiento", () => {
  beforeEach(() => {
    flags.launch = true;
  });

  it.each(["/catalog", "/product/puzzle-perro", "/cart", "/no-existe"])(
    "%s → 307 a /",
    (path) => {
      const res = run(path);
      expect(res.status).toBe(307);
      expect(location(res)).toBe(`${ORIGIN}/`);
    },
  );

  it("/studio-landing → 301 a / (retirada de verdad)", () => {
    const res = run("/studio-landing");
    expect(res.status).toBe(301);
    expect(location(res)).toBe(`${ORIGIN}/`);
  });

  it.each(["/", "/create", "/credits", "/privacy", "/terms"])(
    "%s pasa",
    (path) => {
      expect(passes(run(path))).toBe(true);
    },
  );

  it("un prefijo no autoriza de más: /creditsx → 307", () => {
    expect(run("/creditsx").status).toBe(307);
  });

  it("/admin sin sesión → 307 a / (no hay /login en lanzamiento)", () => {
    const res = run("/admin/orders");
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${ORIGIN}/`);
  });

  it("/admin con sesión de cliente → redirect a /", () => {
    const res = run("/admin/orders", jwt({ sub: "u1", role: "user" }));
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${ORIGIN}/`);
  });

  it("/admin con token ilegible → redirect a /", () => {
    expect(run("/admin", "no-es-un-jwt").status).toBe(307);
  });

  it("/admin con sesión de admin pasa", () => {
    expect(passes(run("/admin/orders", jwt({ sub: "a1", role: "admin" })))).toBe(
      true,
    );
  });

  it("/user con sesión de cliente pasa", () => {
    expect(passes(run("/user/generations", jwt({ sub: "u1", role: "user" })))).toBe(
      true,
    );
  });

  it("/user con sesión de invitado → redirect a /", () => {
    const res = run("/user/generations", jwt({ sub: "g1", role: "guest" }));
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${ORIGIN}/`);
  });
});

describe("proxy — tienda completa (sin lanzamiento)", () => {
  beforeEach(() => {
    flags.launch = false;
  });

  it("/catalog y /product/* vuelven a estar abiertos", () => {
    expect(passes(run("/catalog"))).toBe(true);
    expect(passes(run("/product/puzzle-perro"))).toBe(true);
  });

  it("/user sin sesión → /login con redirect de vuelta", () => {
    const res = run("/user/generations");
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${ORIGIN}/login?redirect=%2Fuser%2Fgenerations`);
  });
});
