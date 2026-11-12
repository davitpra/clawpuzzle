import { describe, expect, it } from "vitest";
import { identityKey, nextIdentityAction } from "./identity";

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
      key: "u1|ana@mail.com",
    });
  });

  it("no repite si el usuario ya está identificado", () => {
    expect(nextIdentityAction(identityKey(ana), ana, false)).toEqual({ type: "none" });
  });

  it("vuelve a identificar si cambia de cuenta", () => {
    expect(nextIdentityAction("u0|otra@mail.com", ana, false)).toMatchObject({
      type: "identify",
      id: "u1",
    });
  });

  it("borra al cerrar sesión", () => {
    expect(nextIdentityAction(identityKey(ana), null, false)).toEqual({ type: "clear" });
  });

  it("visitante anónimo: nada", () => {
    expect(nextIdentityAction(null, null, false)).toEqual({ type: "none" });
  });

  it("nunca identifica a un admin", () => {
    const admin = { ...ana, role: "admin" };
    expect(nextIdentityAction(null, admin, false)).toEqual({ type: "none" });
    expect(nextIdentityAction("u0|", admin, false)).toEqual({ type: "clear" });
  });

  it("al invitado lo identifica solo por id, sin su email sintético", () => {
    const guest = { id: "g1", email: "guest-g1@guest.clawpuzzle.invalid", role: "guest" };
    expect(nextIdentityAction(null, guest, false)).toEqual({
      type: "identify",
      id: "g1",
      email: null,
      key: "g1|",
    });
  });

  it("vuelve a identificar al invitado que se registra (mismo id, ahora con email)", () => {
    const upgraded = { id: "g1", email: "ana@mail.com", role: "user" };
    expect(nextIdentityAction("g1|", upgraded, false)).toMatchObject({
      type: "identify",
      id: "g1",
      email: "ana@mail.com",
    });
  });
});
