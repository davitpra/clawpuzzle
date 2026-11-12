import { describe, expect, it } from "vitest";
import { nextIdentityAction } from "./identity";

const ana = { id: "u1", email: "ana@mail.com", role: "user" };

describe("nextIdentityAction", () => {
  it("no hace nada mientras la sesión carga", () => {
    expect(nextIdentityAction(null, null, true)).toEqual({ type: "none" });
    expect(nextIdentityAction("u1", null, true)).toEqual({ type: "none" });
  });

  it("identifica al usuario nuevo (login o sesión restaurada)", () => {
    expect(nextIdentityAction(null, ana, false)).toEqual({
      type: "identify",
      id: "u1",
      email: "ana@mail.com",
    });
  });

  it("no repite si el usuario ya está identificado", () => {
    expect(nextIdentityAction("u1", ana, false)).toEqual({ type: "none" });
  });

  it("vuelve a identificar si cambia de cuenta", () => {
    expect(nextIdentityAction("u0", ana, false)).toMatchObject({ type: "identify", id: "u1" });
  });

  it("borra al cerrar sesión", () => {
    expect(nextIdentityAction("u1", null, false)).toEqual({ type: "clear" });
  });

  it("visitante anónimo: nada", () => {
    expect(nextIdentityAction(null, null, false)).toEqual({ type: "none" });
  });

  it("nunca identifica a un admin", () => {
    const admin = { ...ana, role: "admin" };
    expect(nextIdentityAction(null, admin, false)).toEqual({ type: "none" });
    expect(nextIdentityAction("u0", admin, false)).toEqual({ type: "clear" });
  });
});
