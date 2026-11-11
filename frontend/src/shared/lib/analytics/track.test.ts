import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Los IDs son constantes de build (NEXT_PUBLIC_*); el mock los expone con
// getters para probar con y sin IDs en el mismo fichero.
const ids = vi.hoisted(() => ({ meta: "", ga: "" }));
vi.mock("@/shared/config/analytics", () => ({
  get META_PIXEL_ID() {
    return ids.meta;
  },
  get GA_MEASUREMENT_ID() {
    return ids.ga;
  },
}));

import {
  clearUser,
  identifyUser,
  isTrackedPath,
  trackEvent,
  trackPageView,
} from "./track";

const fbq = vi.fn();
const gtag = vi.fn();
const HREF = "https://clawpuzzle.com/?utm_source=instagram";

beforeEach(() => {
  ids.meta = "123";
  ids.ga = "G-TEST";
  fbq.mockClear();
  gtag.mockClear();
  vi.stubGlobal("window", { fbq, gtag, location: { href: HREF } });
  vi.stubGlobal("document", { title: "ClawPuzzle" });
});

afterEach(() => vi.unstubAllGlobals());

describe("sin IDs", () => {
  it("no llama a fbq ni a gtag", () => {
    ids.meta = "";
    ids.ga = "";
    trackPageView("/");
    trackEvent({ meta: { name: "ViewContent" }, ga: { name: "view_item" } });
    identifyUser({ id: "u1", email: "a@b.com" });
    clearUser();
    expect(fbq).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("sin librerías (bloqueador)", () => {
  it("no lanza si window.fbq / window.gtag no existen", () => {
    vi.stubGlobal("window", { location: { href: HREF } });
    expect(() => {
      trackPageView("/");
      trackEvent({ meta: { name: "ViewContent" }, ga: { name: "view_item" } });
      identifyUser({ id: "u1", email: "a@b.com" });
    }).not.toThrow();
  });

  it("no lanza en el servidor (sin window)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackEvent({ meta: { name: "X" }, ga: { name: "x" } })).not.toThrow();
  });
});

describe("trackPageView", () => {
  it("manda PageView a Meta y page_view con la URL completa a GA4", () => {
    trackPageView("/create");
    expect(fbq).toHaveBeenCalledWith("track", "PageView");
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/create",
      page_location: HREF,
      page_title: "ClawPuzzle",
    });
  });

  it("ignora el admin", () => {
    trackPageView("/admin/orders");
    trackPageView("/admin-login");
    expect(fbq).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("solo manda a la plataforma que tiene ID", () => {
    ids.ga = "";
    trackPageView("/");
    expect(fbq).toHaveBeenCalledOnce();
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("isTrackedPath", () => {
  it.each([
    ["/", true],
    ["/create", true],
    ["/admin", false],
    ["/admin/print-studio/1", false],
    ["/admin-login", false],
  ])("%s → %s", (path, expected) => {
    expect(isTrackedPath(path)).toBe(expected);
  });
});

describe("trackEvent", () => {
  it("usa track para eventos estándar y trackCustom para los propios", () => {
    trackEvent({ meta: { name: "ViewContent", params: { value: 30 } } });
    trackEvent({ meta: { name: "SelectTheme", params: { theme: "Gato" }, custom: true } });
    expect(fbq).toHaveBeenNthCalledWith(1, "track", "ViewContent", { value: 30 });
    expect(fbq).toHaveBeenNthCalledWith(2, "trackCustom", "SelectTheme", { theme: "Gato" });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("manda el evento de GA4", () => {
    trackEvent({ ga: { name: "select_item", params: { item_list_name: "tema" } } });
    expect(gtag).toHaveBeenCalledWith("event", "select_item", { item_list_name: "tema" });
    expect(fbq).not.toHaveBeenCalled();
  });
});

describe("identifyUser / clearUser", () => {
  it("normaliza el email para Meta y a GA4 solo le manda el id", () => {
    identifyUser({ id: "u1", email: "  Ana@Mail.COM " });
    expect(fbq).toHaveBeenCalledWith("init", "123", {
      em: "ana@mail.com",
      external_id: "u1",
    });
    expect(gtag).toHaveBeenCalledWith("set", { user_id: "u1" });
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("mail");
  });

  it("clearUser borra el user_id de GA4", () => {
    clearUser();
    expect(gtag).toHaveBeenCalledWith("set", { user_id: null });
  });
});
