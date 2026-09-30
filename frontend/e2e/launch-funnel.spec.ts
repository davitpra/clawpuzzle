import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { SESSION_FILE, type E2ESession } from "./session";

// Embudo de lanzamiento de punta a punta: landing → tema de la ficha → estilo
// → foto → generación (MOCK_AI) → checkout de Shopify. El cartCreate va de
// verdad a la Storefront API (valida variante y attributes); lo único que se
// intercepta es la navegación final al checkout, así que nunca se paga.

const PET_PHOTO = path.resolve(__dirname, "../public/puzzle/Otto.webp");

interface CartLine {
  merchandiseId: string;
  quantity: number;
  attributes: { key: string; value: string }[];
}

// Los dos temas: el orden de las variantes difiere entre la ficha y los
// formatos del backend, así que solo probando ambos se garantiza que uno no es
// "la primera" y que el checkout no cae a ella por defecto.
for (const theme of ["Perro", "Gato"] as const) {
  test(`tema ${theme}: landing → /create → generar → checkout con la variante y el arte`, async ({
    page,
    context,
  }) => {
    const session = JSON.parse(
      fs.readFileSync(SESSION_FILE, "utf8"),
    ) as E2ESession;

    // Google no se automatiza: la sesión es la de un usuario sembrado.
    await context.addCookies(
      (["accessToken", "refreshToken"] as const).map((name) => ({
        name,
        value: session[name],
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax" as const,
      })),
    );

    // La navegación al checkout de Shopify se sirve en local: sin pago.
    await page.route(
      (url) =>
        url.hostname !== "localhost" &&
        (url.pathname.includes("/cart/c/") ||
          url.pathname.includes("/checkouts/")),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<h1>checkout interceptado</h1>",
        }),
    );

    // 1. Landing: se elige el tema en la ficha.
    await page.goto("/");
    const themeRadio = page.getByRole("radio", { name: `Tema: ${theme}` });
    // El input está oculto bajo su <label>: se pulsa la etiqueta, como un humano.
    await page.locator("label", { has: themeRadio }).click();
    await expect(themeRadio).toBeChecked();
    await page.getByRole("button", { name: /Crear mi rompecabezas/ }).click();

    await page.waitForURL(/\/create\?.*variant_id=/);
    const variantId = new URL(page.url()).searchParams.get("variant_id");
    expect(variantId).toBeTruthy();

    // 2. Estilo: el primero disponible.
    await page
      .getByRole("button", { name: /^Elegir el estilo / })
      .first()
      .click();
    await page.waitForURL(/style_id=/);

    // 3. Foto y nombre; con sesión abierta "Continuar" dispara la generación.
    await page.getByLabel("Subir fotos de tu mascota").setInputFiles(PET_PHOTO);
    await page.getByLabel("Nombre de tu mascota").fill("Otto");

    const generationResponse = page.waitForResponse(
      (res) =>
        res.url() === `${API_URL}/generations` &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Continuar" }).click();
    const generation = await generationResponse;
    expect(generation.status()).toBe(201);
    const generationId = ((await generation.json()) as { data: { id: string } })
      .data.id;

    // 4. Vista previa lista (MOCK_AI devuelve la foto subida) → pedir.
    const order = page.getByRole("button", { name: /Pedir mi rompecabezas/ });
    await expect(order).toBeEnabled({ timeout: 60_000 });

    const cartRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/shopify/proxy") &&
        (req.postData() ?? "").includes("cartCreate"),
    );
    await order.click();

    const { variables } = (await cartRequest).postDataJSON() as {
      variables: { input: { lines: CartLine[] } };
    };
    const [line, ...rest] = variables.input.lines;
    expect(rest).toHaveLength(0);
    expect(line.merchandiseId).toBe(variantId);
    expect(line.quantity).toBe(1);

    const attrs = Object.fromEntries(
      line.attributes.map((a) => [a.key, a.value]),
    );
    expect(attrs._generation_id).toBe(generationId);
    expect(attrs._user_id).toBe(session.userId);
    expect(attrs._image_url).toMatch(/^https:\/\//);

    // 5. Shopify aceptó el carrito y el navegador salió hacia su checkout.
    await expect(page.getByText("checkout interceptado")).toBeVisible();
    expect(new URL(page.url()).hostname).not.toBe("localhost");
  });
}
