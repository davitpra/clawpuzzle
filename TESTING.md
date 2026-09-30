# ClawPuzzle — plan de tests para el lanzamiento

Última actualización: 2026-09-28.

> Mismas convenciones que `ESTADO.md`: `- [ ]` pendiente, `- [x]` hecho.

## Punto de partida (2026-09-28)

| Parte              | Estado                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend — unit     | 10 suites, **80 tests en verde**, heredados de ClawAndSoul (orders, credits, product-sync, fal, image-enhancement…). ~96 s y un worker que no cierra limpio. |
| Backend — e2e      | `test/app.e2e-spec.ts` es el boilerplate de Nest (`GET /` → "Hello World!"): roto, no prueba nada.                                                             |
| Frontend           | 0 tests, sin runner.                                                                                                                                            |
| CI                 | No existe.                                                                                                                                                      |

## Criterio: el camino del dinero, no la cobertura

El lanzamiento es un solo embudo, y cada fallo en él es una venta perdida o un
puzzle mal producido:

```
landing → login Google → /create (foto, estilo, generar con crédito)
→ checkout Shopify con _generation_id → webhook orders/* (HMAC)
→ orden vinculada al arte → cola de producción del admin → envío
```

**Fuera de alcance por ahora:** stats del admin, expenses, compat, catálogo y
carrito (ocultos por `LAUNCH_MODE`), snapshots de UI.

**Orden recomendado:** Fase 0 → HMAC + webhook e2e → resto de la Fase 1 →
paridad de la máquina de estados → frontend. Si solo hubiera tiempo para una
cosa: el e2e del webhook firmado.

---

## Fase 0 — Higiene

- [x] Sustituir el `app.e2e-spec.ts` boilerplate por un e2e que pase. Ahora es
      un humo de `GET /api/health` que levanta solo el `HealthController`, sin
      Postgres ni Redis. Deja el arnés listo para la Fase 2.
- [x] Acelerar Jest: `tsconfig.spec.json` con `isolatedModules` (ts-jest
      transpila fichero a fichero). **96 s → ~10 s.** Los tipos de los specs
      los sigue cubriendo `npm run typecheck`. El aviso de "worker failed to
      exit" desapareció con esto: era el timeout de la compilación lenta, no
      un handle abierto (3 ejecuciones limpias).
- [x] GitHub Action (`.github/workflows/ci.yml`): backend `typecheck` +
      `eslint` sin `--fix` + `test` + `test:e2e` + `test:int` (Fase 2, con
      servicios Postgres y Redis); frontend `typecheck` +
      `lint` + `test` (este último desde la Fase 3). Para que
      pasara hubo que arreglar dos errores de Prettier que ya estaban en
      `credits.service.ts` y `admin-products.controller.ts`.

## Fase 1 — Backend unit: huecos críticos

- [x] **`ShopifyHmacGuard`** (`common/guards/shopify-hmac.guard.spec.ts`):
      firma válida pasa; body alterado, otro secreto, sin cabecera, body ya
      parseado (no `Buffer`), firma de otra longitud y secreto sin configurar
      → 401.
- [x] **`GenerationsService.createImageGeneration`**
      (`generations/generations.service.spec.ts`, con `CreditsService` real):
      descuenta 1 crédito y encola; sin saldo → 402 lanzado **dentro** de la
      transacción y sin encolar (el rollback real de la fila queda para la
      Fase 2); admin no paga; mascota ajena / estilo inactivo / formato sin
      variante → 400, producto inexistente o inactivo → 404, sin tocar la DB.
      Del formato: la fila guarda el `formatId` validado contra la variante;
      el tramo `format → resolveImageSize → image_size` ya lo cubre
      `fal.service.spec.ts`. Ojo: `metadata.width/height` sale del DTO
      (`|| 1024`) y no es lo que llega a fal.
- [x] **`markFailed`**: reembolsa el crédito; la segunda llamada choca con el
      unique del ledger y no reembolsa otra vez; sin gasto previo (admin) no
      reembolsa; los items pagados en `generating` pasan a `art_failed`.
- [x] **`production-status.util.ts`** (`production-status.util.spec.ts`):
      transiciones válidas e inválidas (`printed → shipped` rechazada: todo
      pasa por `packed`), terminales, cobertura de estados y la tabla de
      `computeAutoEarlyStatus`.
- [x] **Paridad** (`orders/production-status.parity.spec.ts`): compara
      `VALID_TRANSITIONS` y `CANCELLABLE_STATUSES` con
      `frontend/src/entities/admin/lib/order-transitions.ts`, y que cada
      estado tenga etiqueta y tono en `production-status.ts`. **Encontró un bug
      real:** el frontend no conocía `packed` (ofrecía `printed → shipped`, que
      el backend rechaza con 400). Arreglado en `order-transitions.ts`,
      `production-status.ts`, `order-filters.ts` y `ProductionQueueCard.tsx`.

Limpieza que salió de la Fase 1:

- [x] Quitada la máquina `accessory` del admin (herencia de ClawAndSoul; el
      backend ya no tiene `isAccessory`): `transitionsFor` y
      `productionStatusLabel` ya no reciben el tipo, y `SimpleOrderItemCard`
      queda solo para packs de créditos, sin controles. La paridad compara
      ahora también `transitionsFor` estado a estado y `orderItemKind`
      (`puzzle` en el backend ↔ `art` en el admin).
- [x] Borrado `backend/src/shopify-sync/guards/shopify-hmac.guard.ts`,
      duplicado sin usar del guard de `common/guards/`.

## Fase 2 — Backend integración (Postgres real)

`npm run test:int` (en `backend/`). `AppModule` completo contra Postgres y
Redis reales, `MOCK_AI=true`; solo se sustituye `ShopifyApiService` (llamaría
a la Admin API). 11 tests, ~9 s. En CI corre con servicios `postgres:17` y
`redis:7`.

- En local usa la base `clawpuzzle_test` (mismo usuario/host que el
  `DATABASE_URL` de `.env`; `TEST_DATABASE_URL` lo sustituye) y la DB 15 de
  Redis (`TEST_REDIS_URL`). El `globalSetup` crea la base y corre
  `prisma migrate deploy`. Se niega a arrancar si la base no termina en
  `_test`: cada test hace `TRUNCATE` de todo.
- La configuración de la app (`express.raw`, prefijo, cookies, pipes…) salió
  de `main.ts` a `src/app.setup.ts` (`configureApp`), que usan tanto
  producción como los tests.
- `uuid` v13 es ESM-only: la suite lo mapea a `crypto.randomUUID`.
- Con Redis < 6.2 (el de WSL es 6.0) BullMQ imprime un aviso por conexión;
  es ruido, no un fallo.

- [x] **El test más valioso** (`test/integration/shopify-order-webhook.int-spec.ts`):
      `orders/create` firmado → orden con la línea vinculada a la generación
      del usuario, `productionStatus: draft` y +3 créditos; firma con otro
      secreto → 401 y nada en la DB; `_generation_id` ajeno → línea sin
      vincular. Comprobado que detecta el fallo silencioso: registrar el parser
      JSON antes que `express.raw` en `configureApp` pone 4 de 5 en rojo.
- [x] Idempotencia: el mismo webhook dos veces → una orden, una línea, un
      `order_bonus`; `create` pendiente → `paid` → `paid` otra vez → bono una
      sola vez. Ojo: con `removeOnComplete` el `jobId` de BullMQ **no**
      deduplica un reintento que llega tras procesarse el primero; la
      idempotencia real la dan el upsert de la orden y el unique del ledger.
- [x] Generación de punta a punta (`generation.int-spec.ts`): POST → processor
      BullMQ → `completed` con la estrategia mock, saldo 1 → 0 y un
      `generation_spend`. Sin saldo → 402 y ni fila de `Generation` ni
      movimiento en el ledger (el rollback real que la Fase 1 dejó pendiente).
- [x] Auth (`auth.int-spec.ts`): sin cookie → 401; cliente en `/admin/orders`
      → 403, admin → 200; el password no vale para clientes; el refresh rota y
      reutilizar el viejo → 401. **Encontró un bug real:** el refresh token no
      llevaba `jti`, así que un refresh en el mismo segundo que el login (o que
      el refresh anterior) generaba el mismo JWT, chocaba con el unique de
      `RefreshToken.token` y devolvía 401 con el token viejo ya revocado: la
      sesión se perdía. Arreglado con `jwtid: randomUUID()` en
      `AuthService.generateTokens`.
- Los clientes solo entran por Google, así que la suite les fabrica la sesión
  firmando el access token con el secreto de test (`userSession` en
  `harness.ts`); los admins usan el login por password real.

## Fase 3 — Frontend

**Vitest** (lógica pura) — `npm test` en `frontend/`, 32 tests, <1 s, entorno
node sin DOM. En CI tras `lint`. Para testear sin montar contextos de React se
extrajeron tres funciones puras de los hooks, sin cambio de comportamiento.

- [x] `proxy.ts` (`src/proxy.test.ts`): con `LAUNCH_MODE`, `/catalog`,
      `/product/*`, `/cart` y rutas inexistentes → 307 a `/`;
      `/studio-landing` → 301; `/creditsx` no pasa por el prefijo `/credits`;
      `/admin` sin sesión, con rol cliente o con token ilegible → `/`; admin
      pasa. Sin `LAUNCH_MODE`: la tienda se abre y `/user` sin sesión va a
      `/login?redirect=…`. El flag se mockea con un getter para probar ambos
      modos.
- [x] Checkout: `buildCheckoutLines` (`hooks/lib/checkoutLines.ts`, lo usa
      `useShopifyCheckout`) → la línea lleva la variante, `_generation_id`,
      `_image_url` y `_user_id`, todos con `_`; sin sesión no hay `_user_id`;
      sin variante la línea se descarta. La variante Perro | Gato se elige en
      `pickOfferVariant` (`widgets/ia-generator/model/offerVariant.ts`, antes
      inline en `app/create/page.tsx`): se vende la que llegó de la ficha
      aunque Shopify liste Perro primero; si está agotada, otra del formato.
- [x] 402: `isOutOfCreditsError` (`widgets/ia-generator/model/outOfCredits.ts`,
      lo usa `useCreateGeneration`) decide por el status, no por el texto; y
      `fetchJSON` convierte el 402 del backend en un `ApiError` con status y
      mensaje, que es lo que hace aparecer el CTA a `/credits`.

**Playwright** — `npm run test:e2e` en `frontend/`. **Solo local, no va en
CI** (decisión: fidelidad antes que automatización): usa la base de desarrollo,
la Storefront API real de Shopify y Cloudinary con las credenciales de
`backend/.env` y `frontend/.env.local`. ~1 min 15 s, casi todo arranque.

- [x] `e2e/launch-funnel.spec.ts`, una vez por tema (Perro y Gato): landing →
      tema en la ficha → "Crear mi rompecabezas" → estilo → foto + nombre →
      generación (`MOCK_AI`) → "Pedir mi rompecabezas". El `cartCreate` va de
      verdad a Shopify (valida variante y attributes); solo se intercepta la
      navegación final al checkout, así que no se paga. Comprueba que la
      línea lleva la variante elegida, `_generation_id` de la generación
      creada, `_user_id` e `_image_url`.
      Se prueban los dos temas porque el orden de variantes de la ficha
      (Gato primero) y el de los formatos del backend (Perro primero) no
      coinciden: con uno solo, "caer a la primera variante" pasaba
      inadvertido. Comprobado: forzar `pickOfferVariant` a la primera pone en
      rojo el caso Gato.
- [x] Login: `backend/scripts/e2e-session.ts` crea el usuario
      `e2e-smoke@clawpuzzle.test` (5 créditos) y le emite access + refresh
      como `AuthService`; Playwright los inyecta como cookies. El teardown
      borra el usuario (cascada) y sus fotos de Cloudinary.
- El `playwright.config.ts` levanta su propio stack en puertos aparte: API
  en 3101 compilada a `backend/node_modules/.cache/e2e-dist` (no pisa el
  `dist` de un `start:dev`) con `MOCK_AI=true` y Redis DB 14 (si compartiera
  cola con el `start:dev` de 3001, que tiene `MOCK_AI=false`, su worker
  podría llevarse el job y gastar fal.ai de verdad); web en 3100 con
  `next build && next start` y `NEXT_PUBLIC_LAUNCH_MODE=true`. Ojo: deja en
  `.next` un build que apunta a la API de e2e; rehaz `next build` antes de
  un `npm start` propio (`npm run dev` no se ve afectado).

## Fase 4 — Checklist manual pre-apertura

- [ ] Orden real de prueba en Shopify (gateway de prueba): checkout en español
      y webhook llegando a `api.clawpuzzle.com`.
- [ ] Login en el dominio real: la cookie `sameSite=lax` entre
      `clawpuzzle.com` y `api.` (si falla: todo 401 tras el login).
- [ ] Muestra impresa por cada estilo del lanzamiento (riesgo de resolución de
      `ESTADO.md`).
