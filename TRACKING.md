# Tracking de Meta (Facebook) y Google — paso a paso

Objetivo:

- **Meta (Facebook/Instagram):** medir el embudo y las compras para optimizar los anuncios.
- **Google Analytics 4:** solo analítica, para saber cuántas personas entran a la página y cuántas avanzan por el embudo. **No se pauta en Google por ahora** (sin Google Ads).

Embudo: landing (`/`) → elegir tema Perro/Gato → `/create` (login Google + foto + arte IA) → checkout de Shopify.

## Lo que condiciona todo el plan

1. **La compra ocurre en el checkout de Shopify, no en Next.js.** El sitio manda los eventos del embudo; el `Purchase` sale de Shopify.
2. **La tienda Shopify es compartida con Puzzle Salvaje** (`puzzlesalvaje.myshopify.com`). La app "Facebook & Instagram" solo admite un píxel por tienda y ese es el de Puzzle Salvaje. El `Purchase` de ClawPuzzle sale de un **píxel personalizado** de Shopify (paso 5) que solo se dispara en pedidos de ClawPuzzle.
3. **El checkout está en otro dominio** que `clawpuzzle.com`. Las cookies de Meta y de GA4 no viajan entre dominios, así que:
   - Meta une la compra con la visita por el **email** y el **ID de usuario** (`external_id`), no por cookie. Por eso el paso 4 (coincidencia avanzada) es obligatorio, no opcional.
   - GA4 mide visitas y embudo **hasta `begin_checkout`**. Las compras se miran en el admin de ClawPuzzle / Shopify, no en GA4.

## IDs (rellenar a medida que se consigan)

| Qué                        | Valor             |
| -------------------------- | ----------------- |
| Meta Pixel ID (ClawPuzzle) | `491111479034888` |
| GA4 Measurement ID         | `G-SKTHBGTFGQ`    |

## Orden recomendado

Paso 1 (tú) y pasos 2–4 + 6 (código) pueden ir en paralelo. El paso 5 necesita el Pixel ID. El paso 7 (verificación) va al final, con todo desplegado.

---

## Paso 1 — Cuentas e IDs · 👤 tú (paneles)

- [x] **Meta**: Business Manager → Events Manager → _Conectar datos_ → Web → crear un Dataset/Píxel **nuevo** llamado `ClawPuzzle` → copiar el Pixel ID.
- [] **Meta**: verificar el dominio `clawpuzzle.com` (Business Settings → Brand safety → Domains; se hace con un registro TXT en el DNS).
- [ ] **Meta**: Events Manager → píxel ClawPuzzle → Settings → activar _Automatic advanced matching_ (Email y External ID).
- [x] **Google**: analytics.google.com → crear cuenta `ClawPuzzle` → propiedad `clawpuzzle.com` (zona horaria Ecuador, moneda USD) → flujo de datos **Web** para `clawpuzzle.com` → copiar el `G-XXXX`.
- [x] **Google**: en ese flujo → _Medición mejorada_ (engranaje) → _Vistas de página_ → Mostrar configuración avanzada → **desmarcar** "La página cambia en función de los eventos del historial del navegador". Las vistas las manda el código (paso 3); si se deja marcado, se cuentan dobles.
- [x] **Shopify**: **no** tocar la app "Facebook & Instagram" (sigue en el píxel de Puzzle Salvaje) y **no** instalar "Google & YouTube".

## Paso 2 — Variables de entorno · 🤖 código + 👤 tú (Vercel)

- [x] Añadir a `frontend/.env.example` (con comentario, como las demás) y a la tabla de variables de `frontend/CLAUDE.md`:
  - `NEXT_PUBLIC_META_PIXEL_ID`
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [x] Nuevo `frontend/src/shared/config/analytics.ts` que las exporte (`META_PIXEL_ID`, `GA_MEASUREMENT_ID`), igual que `shared/config/launch.ts`. El resto del código lee de ahí.
- [x] 👤 Vercel → proyecto del frontend → Settings → Environment Variables → añadir las dos **solo en Production** → Redeploy (las `NEXT_PUBLIC_*` se inlinean en build).

Sin IDs no se carga ningún script: dev, previews y e2e quedan limpios.

## Paso 3 — Scripts y vistas de página · 🤖 código

Módulo nuevo `frontend/src/shared/lib/analytics/`:

- [x] `track.ts` — helpers sin React, todos no-op si no hay ID o si `window.fbq` / `window.gtag` no existen (bloqueadores):
  - `trackPageView(path)`
  - `trackEvent({ meta?: { name, params, custom? }, ga?: { name, params } })` — `custom: true` usa `fbq('trackCustom', …)`.
  - `identifyUser({ id, email })` / `clearUser()` (paso 4).
  - Declarar los tipos de `window.fbq`, `window.gtag`, `window.dataLayer`.
- [x] `AnalyticsScripts.tsx` (server) — con `next/script`: los stubs de `gtag`/`fbq` van `beforeInteractive` (existen antes de hidratar, así no se pierde la primera vista) y `gtag.js` va `afterInteractive`:
  - GA4: cargar `https://www.googletagmanager.com/gtag/js?id=…` y `gtag('config', GA_ID, { send_page_view: false })`.
  - Meta: snippet estándar + `fbq.disablePushState = true` (si no, el píxel manda su propio PageView en cada navegación) + `fbq('init', PIXEL_ID)`. **Sin** `fbq('track','PageView')` en el snippet.
  - Meta: también `fbq.allowDuplicatePageViews = true`. Sin él, fbevents descarta en silencio todo `PageView` después del primero de la carga y las navegaciones del cliente no llegan (comprobado con el píxel real).
  - No renderiza nada si falta el ID correspondiente.
- [x] `PageViewTracker.tsx` (client) — `usePathname()` en un `useEffect`; llama a `trackPageView` en la primera carga y en cada cambio de ruta. **No** hace nada si la ruta empieza por `/admin` (cubre `/admin-login`). No usar `useSearchParams` (obligaría a un `<Suspense>` y los UTM ya los lee gtag de la URL).
- [x] Montar ambos en `frontend/src/app/layout.tsx`, dentro de `<AuthProvider>` (el paso 4 necesita `useAuth`).
- [x] Test unitario (vitest) de `track.ts`: no-op sin IDs y sin `window.fbq`; llama a `fbq`/`gtag` con los nombres correctos cuando existen.

No hay Content-Security-Policy en el proyecto, así que no hay que permitir dominios nuevos.

## Paso 4 — Identificar al usuario (coincidencia avanzada, solo Meta) · 🤖 código

Es lo que permite a Meta unir la visita en `clawpuzzle.com` con la compra en el checkout de Shopify.

- [x] Componente `AnalyticsIdentity` (o dentro de `PageViewTracker`): `useAuth()` → cuando `user` pasa a existir, `identifyUser`; cuando pasa a `null`, `clearUser`. Cubre el login nuevo **y** al usuario que vuelve con sesión (`checkAuth`).
- [x] `identifyUser` hace `fbq('init', PIXEL_ID, { em: email.trim().toLowerCase(), external_id: user.id })`. El píxel hashea en SHA-256; el email no sale en claro.
- [x] GA4: solo `gtag('set', { user_id: user.id })`. **Nunca** el email (GA4 prohíbe datos personales).
- [x] No identificar si `user.role === 'admin'`.

## Paso 4b — Eventos del embudo · 🤖 código

| ✔   | Momento                    | Dónde exactamente                                                                                                                                             | Meta                                                                          | GA4                                  |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| [x] | Vista de página            | `PageViewTracker`                                                                                                                                             | `PageView`                                                                    | `page_view`                          |
| [x] | Ver la ficha en la landing | `widgets/studio-landing/ui/LandingProductDetailsClient.tsx`, `useEffect` al montar (la landing es server component; este es el client que ya tiene `product`) | `ViewContent` (`content_ids`, `content_type: 'product'`, `value`, `currency`) | `view_item`                          |
| [x] | Elegir tema                | mismo archivo: envolver `setSelectedVariantId` y disparar solo si el id **cambia** (no en el montaje: `ProductDetails` lo fija solo al cargar formatos)       | `SelectTheme` (custom, `theme: 'Perro' \| 'Gato'`)                            | `select_item`                        |
| [x] | Registro / login           | `context/AuthContext.tsx`, en `loginWithGoogle` y `loginWithGoogleCode` tras `setUser` (no en `checkAuth`)                                                    | `CompleteRegistration` solo si es cuenta nueva                                | `sign_up` si es nueva, `login` si no |
| [x] | Arte IA listo              | `widgets/ia-generator/ui/IAGeneratingStep.tsx`: `useEffect` cuando `imageUrl` pasa a tener valor, una vez por `generationId`                                  | `GenerateArt` (custom)                                                        | `generate_art`                       |
| [x] | Ir al checkout             | `hooks/useShopifyCheckout.ts`, cuando `cartCreate` devuelve `checkoutUrl`, antes de `window.location.href`                                                    | `InitiateCheckout` (`value`, `currency: 'USD'`, `num_items`, `content_ids`)   | `begin_checkout`                     |
| [x] | Compra                     | Shopify → píxel personalizado (paso 5)                                                                                                                        | `Purchase`                                                                    | — (ver admin)                        |

Detalles:

- [x] **Cuenta nueva vs. login** — hoy el backend no lo dice. Añadir `isNewUser: boolean` a la respuesta de `loginWithGoogle` en `backend/src/auth/auth.service.ts` (ya distingue: `findUnique` por email y `user.create` si no existe), al tipo `AuthResponse` de `frontend/src/lib/auth/client.ts`, y usarlo en `AuthContext`. Sin esto, `CompleteRegistration` se inflaría con cada login.
- [x] **Checkout** — `value` = suma de `price * quantity` de los `CartItem`. Con GA4 usar `transport_type: 'beacon'`; tras disparar ambos, esperar ~300 ms antes de redirigir para que el píxel de Meta alcance a salir. Cubre los tres puntos que llaman a `startCheckout` (arte IA, packs de créditos, carrito).
- [x] Añadir un caso al test de `hooks/lib/checkoutLines` o del hook si el cambio toca el contrato; los attributes de las líneas **no** cambian. (No hizo falta: el contrato no cambió. Los nombres y parámetros de cada evento se prueban en `shared/lib/analytics/events.test.ts`.)
- Cómo quedó: los eventos se arman en `shared/lib/analytics/events.ts`. `sign_up`/`login` se encolan en `AuthContext` y salen desde `AnalyticsIdentity` justo después de `identifyUser`, así llevan email y external_id. `SelectTheme` solo cuenta cambios hechos por el visitante (click o tecla dentro de la ficha).

## Paso 5 — `Purchase` de ClawPuzzle con un píxel personalizado de Shopify · 👤 tú (panel) + 🤖 script

Los píxeles personalizados son independientes de la app de Facebook; puede haber varios en la misma tienda.

- [x] Shopify Admin → **Configuración → Eventos de clientes → Añadir píxel personalizado** → nombre `ClawPuzzle Meta`.
- [x] Privacidad del cliente: _Permiso: No requerido_ (si no hay banner de cookies en la tienda) o _Marketing_ (si lo hay). Venta de datos: _Los datos recopilados no se consideran venta_.
- [x] Pegar el script con el Pixel ID de ClawPuzzle → **Guardar** → **Conectar**.

```js
// Píxel personalizado de Shopify: Purchase SOLO para pedidos de ClawPuzzle.
const CLAW_PIXEL_ID = "491111479034888"; // Pixel ID de ClawPuzzle

// Snippet estándar de Meta, cargado dentro del sandbox de Shopify.
!(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = "2.0";
  n.queue = [];
  t = b.createElement(e);
  t.async = !0;
  t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(
  window,
  document,
  "script",
  "https://connect.facebook.net/en_US/fbevents.js",
);

const prop = (line, key) =>
  (line.properties || []).find((p) => p.key === key)?.value;

// Una línea es de ClawPuzzle si lleva las propiedades que añade nuestro
// checkout (_user_id / _generation_id). Respaldo: el título del producto.
function isClawLine(line) {
  if (prop(line, "_generation_id") || prop(line, "_user_id")) return true;
  const title = line.variant?.product?.title || line.title || "";
  return /claw\s*puzzle/i.test(title);
}

analytics.subscribe("checkout_completed", (event) => {
  const checkout = event.data.checkout;
  const clawLines = (checkout.lineItems || []).filter(isClawLine);
  if (clawLines.length === 0) return; // pedido de Puzzle Salvaje → nada

  // Mismos identificadores que manda el sitio (paso 4): así Meta une la
  // compra con la visita aunque el checkout esté en otro dominio.
  const userData = {};
  const email = (checkout.email || "").trim().toLowerCase();
  if (email) userData.em = email; // Meta lo hashea
  const userId = clawLines.map((l) => prop(l, "_user_id")).find(Boolean);
  if (userId) userData.external_id = userId;
  fbq("init", CLAW_PIXEL_ID, userData);

  const value = clawLines.reduce(
    (sum, l) =>
      sum +
      Number(l.finalLinePrice?.amount ?? l.variant.price.amount * l.quantity),
    0,
  );

  fbq(
    "track",
    "Purchase",
    {
      value,
      currency: checkout.currencyCode || "USD",
      content_type: "product",
      content_ids: clawLines.map((l) => l.variant.id),
      num_items: clawLines.reduce((n, l) => n + l.quantity, 0),
    },
    { eventID: `order_${checkout.order?.id}` },
  );
});
```

- [ ] **Puzzle Salvaje**: en _su_ Events Manager, crear una **conversión personalizada** "Compra Puzzle Salvaje" que excluya los productos de ClawPuzzle, y usarla en sus campañas. Su píxel seguirá recibiendo las compras de ClawPuzzle (es la misma tienda); esto evita que afecten su optimización.

**Sin verificar todavía (se comprueba en el paso 7):**

- Que Shopify entregue al píxel las propiedades de línea que empiezan por `_`. Si no llegan, queda el respaldo por título, pero se pierde `external_id`.
- Que Meta atribuya la compra al anuncio sin cookie compartida entre dominios.

**Si la atribución sale pobre** (compras en Events Manager que Ads Manager no asigna a campañas): pasar a la API de Conversiones desde el webhook `orders/paid` del backend, guardando `_fbp`/`_fbc` como attributes de línea en `buildCheckoutLines`, con el mismo `eventID` para no contar doble.

## Paso 6 — Privacidad (Ecuador, LOPDP) · 🤖 código

- [ ] `frontend/src/app/privacy/page.tsx`: nueva sección "Cookies y medición": Google Analytics (analítica de visitas), píxel de Meta (medición de anuncios), y que el email se comparte **hasheado** con Meta. Ajustar la sección "Seguridad", que hoy solo menciona cookies de sesión.

## Paso 7 — Verificación

En local (`npm run dev` con los IDs en `frontend/.env.local`):

- [ ] `npm run test`, `npm run typecheck` y `npm run lint` en verde.
- [ ] `npm run test:e2e` (`e2e/launch-funnel.spec.ts`) en verde **sin** IDs: no se pide ningún script de Meta/Google.
- [ ] GA4 → _Tiempo real_: una sola `page_view` por navegación (no dobles), y ninguna al entrar a `/admin`.
- [ ] GA4 → DebugView (extensión Tag Assistant): `view_item`, `select_item`, `sign_up`/`login`, `generate_art`, `begin_checkout`.
- [ ] Meta Pixel Helper + Events Manager → _Test events_: `PageView` (uno por navegación), `ViewContent`, `SelectTheme`, `CompleteRegistration` (solo con cuenta nueva), `GenerateArt`, `InitiateCheckout` con `value`.
- [ ] Tras el login, los eventos de Meta muestran parámetros de coincidencia "Email" y "External ID".

En producción:

- [ ] Shopify → Eventos de clientes → `ClawPuzzle Meta` → _Probar_: hacer un pedido de ClawPuzzle y confirmar en la consola que `isClawLine` detecta la línea **por propiedades** (no solo por título).
- [ ] Pedido de prueba **de ClawPuzzle** (gateway de prueba o pedido real reembolsado): `Purchase` llega al píxel de ClawPuzzle con el valor correcto, Email y External ID.
- [ ] Pedido de prueba **de un producto de Puzzle Salvaje**: el píxel de ClawPuzzle **no** recibe nada.
- [ ] Abrir `clawpuzzle.com/create` desde un DM de Instagram en el móvil y probar el login con Google (el navegador interno de Instagram puede bloquearlo; si falla, hay que resolverlo antes de pautar).
- [ ] A los 2–3 días: Events Manager → _Calidad de coincidencia de eventos_ de `Purchase` ≥ 6, y GA4 → excluir tu tráfico (Admin → Flujos de datos → Configurar etiqueta → _Definir tráfico interno_ con tu IP + activar el filtro en Admin → Filtros de datos).

## Uso diario

- **Anuncios de Meta**: el enlace del anuncio debe apuntar a `https://clawpuzzle.com/` (la raíz; en modo lanzamiento las demás rutas de tienda redirigen a `/` y pierden los parámetros), con UTM: `?utm_source=instagram&utm_medium=paid&utm_campaign=lanzamiento`.
- **Visitas**: GA4 → Informes → _Tiempo real_ y _Adquisición → Adquisición de tráfico_.
- **Embudo**: GA4 → Explorar → _Exploración de embudo_ con `page_view` → `select_item` → `sign_up` → `generate_art` → `begin_checkout`.
- **Compras**: admin de ClawPuzzle / Shopify, y `Purchase` en Events Manager.

---

## Más adelante

- **API de Conversiones** de Meta desde el backend (ver paso 5).
- **Google Ads**: crear la cuenta, vincularla con GA4 y medir la compra desde el backend (Measurement Protocol), ya que GA4 no ve el checkout.
- **Login con Facebook**, si la prueba de Instagram del paso 7 falla.
