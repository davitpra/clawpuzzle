import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchJSON } from "@/lib/auth/fetch-with-refresh";
import { isOutOfCreditsError } from "./outOfCredits";

describe("isOutOfCreditsError", () => {
  it("se decide por el status 402", () => {
    expect(isOutOfCreditsError(new ApiError("Sin créditos", 402))).toBe(true);
  });

  it("no por el texto del error", () => {
    expect(
      isOutOfCreditsError(new Error("Insufficient generation credits")),
    ).toBe(false);
    expect(
      isOutOfCreditsError(new ApiError("Insufficient generation credits", 400)),
    ).toBe(false);
    expect(isOutOfCreditsError(new ApiError("", 402))).toBe(true);
  });

  it("tolera valores que no son errores", () => {
    expect(isOutOfCreditsError(undefined)).toBe(false);
    expect(isOutOfCreditsError({ status: 402 })).toBe(false);
  });
});

// El tramo previo: el 402 del backend tiene que llegar como ApiError con su
// status, o el CTA a /credits no aparece nunca.
describe("fetchJSON ante el 402 de POST /generations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lanza un ApiError con status 402 y el mensaje del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { statusCode: 402, message: "No te quedan créditos" },
          { status: 402 },
        ),
      ),
    );

    const err = await fetchJSON("http://api.test/generations", {
      method: "POST",
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(402);
    expect((err as ApiError).message).toBe("No te quedan créditos");
    expect(isOutOfCreditsError(err)).toBe(true);
  });
});
