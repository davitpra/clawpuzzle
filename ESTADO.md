# ClawPuzzle — estado del proyecto

Ecommerce de rompecabezas personalizados, derivado de ClawAndSoul. El cliente
sube la foto de su mascota, genera arte con IA y lo compra impreso como puzzle.

Última actualización: 2026-09-22.

> Las casillas son listas de tareas de Markdown: `- [ ]` pendiente, `- [x]`
> hecho. Se marcan clicando en la vista previa de VS Code, o con `Alt+C` sobre
> la línea si tienes la extensión _Markdown All in One_.

---

## Qué está hecho

- [x] **Fase 0 — copia y saneamiento.** `backend/` y `frontend/` se clonaron de
      ClawAndSoul con su historia completa (152 y 391 commits) y **sin remotos**:
      no pueden empujar al original por accidente. Renombrado de marca aplicado en
      41 archivos de código, nombres de paquete (`clawpuzzle-api`, `clawpuzzle-web`),
      título de Swagger y clave de localStorage del carrito (`clawpuzzle_cart`).

- [x] **Fase 1 — poda.** Eliminado todo lo que no aplica a un puzzle:

  | Qué                          | Backend                                                              | Frontend                                                                                              |
  | ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
  | Paint-by-numbers             | modelo Prisma, módulo, servicio, endpoints                           | 93 archivos: `lib/pbn`, `widgets/studio`, `features/pbn-studio`, `/studio`, `/user/pbn`, `/admin/pbn` |
  | Producción POD               | `orders/pod/`, catálogo Pictorem, `fulfillmentMethod`, `podProvider` | selector de fulfillment, modal de config POD                                                          |
  | Eje `artKind` (pbn \| print) | columna, util de normalización, metafield del sync, queries GraphQL  | modelo, labels, filtros, badges                                                                       |
  | Accesorios                   | `isAccessory`, máquina de estados reducida                           | `AccessoryTemplate`, `related-products`, upsells                                                      |

- [x] **Fase 2 — modelo del puzzle.**
  - `template` pasa a `Puzzle | Credits` (de cinco valores a dos).
  - `Format` gana `pieceCount`, `printWidthCm` y `printHeightCm`. Los tres
    formatos del seed son 300 / 500 / 1000 piezas, todos en 4:3 para que el
    mismo arte sirva a cualquier tamaño sin regenerar.
  - Después: el `Format` pasa a ser **solo la proporción** (`ratio_4_3`). Las
    piezas y el tamaño salen del formato; el tamaño vive en el `printConfig` de
    la variante y el producto fija el formato (`ProductReference.formatId`) que
    heredan todas sus variantes. Migración `20260924120000_format_by_aspect_ratio`.
  - Formato `a3_portrait` (A3 vertical, 848×1200 px). Las generaciones envían
    `width`/`height` del formato como `image_size`: `fal-ai/flux/dev` ignora
    `aspect_ratio`, así que hasta ahora todo salía a su 1024×768 por defecto.
    Al asignar A3 a un producto, sus variantes necesitan `printConfig`
    `{ widthCm: 29.7, heightCm: 42 }`; a 848×1200 px el A3 queda a ~73 DPI y
    el estudio de impresión pedirá upscale.
  - Formato `ratio_2_3` (832×1248 px). Desde el 2026-10-19 sustituye al A3 en
    `claw-puzzle`, que se imprime a 20 × 30 cm. La migración
    `20261019120000_format_ratio_2_3` crea el formato y le pasa los productos
    en A3 con sus variantes; el `printConfig` cambia a 20 × 30 cm y conserva
    la sangre y el DPI. `a3_portrait` se queda por las generaciones antiguas.
  - `podConfig` → `printConfig` (`{widthCm, heightCm, bleedMm, safeMarginMm, minDpi}`).
  - `productionStatus` gana `packed` entre `printed` y `shipped`: troquelar,
    contar piezas y encajar es un paso físico real. Queda **una sola** máquina
    de estados (la de accesorios desapareció).
  - `PuzzlePieceOverlay` sustituye a `CanvasEdgeOverlay` en los siete puntos del
    storefront que consumían el eje `FrameStyle`.
    Más tarde (`adbe220`) se eliminó del todo: las fotos de producto ya traen su
    propia escena y la retícula se pintaba encima. Hoy `FrameStyle` solo
    decide la sombra (`FRAME_SHADOWS`).

- [x] **Fase 3 — repositorio único.** Los dos repos independientes se fusionaron en
      uno solo en la raíz del proyecto: ~550 commits, rama `main`. Cada historia
      se reescribió bajo su prefijo (`backend/`, `frontend/`) antes de fusionarse,
      así que `git log --follow` y `git blame` siguen funcionando archivo por archivo
      hasta el `inicio repo` original. Un cambio que toca las dos mitades a la vez
      —la máquina de estados duplicada, sin ir más lejos— ya viaja en un commit
      atómico. Remoto: `git@github.com:davitpra/clawpuzzle.git`, privado. Los `.git`
      previos quedaron respaldados en `../clawpuzzle-git-backup/`; se pueden borrar
      cuando el remoto esté confirmado.

**Verificado:** backend y frontend pasan `typecheck`, `lint` y `build`. El
backend pasa sus 72 tests.

---

## Tres bugs latentes que se encontraron y corrigieron

No eran parte del plan; salieron al podar y los tres habrían fallado **en
runtime**, no en compilación:

- [x] **El sync de productos escribía columnas inexistentes.** `upsertProduct`
      metía `artKind` e `isAccessory` con un spread condicional, y ese patrón hace
      que TypeScript no valide el objeto contra el modelo Prisma. Al quitar las
      columnas del schema el typecheck siguió en verde. Cubierto ahora con un test
      que fija exactamente qué campos escribe el upsert.

- [x] **SQL crudo contra una tabla borrada.** `admin/stats/user-cohort.stats.ts`
      hacía `SELECT 1 FROM paint_by_numbers` dentro de un `$queryRaw`. Invisible
      para el compilador; habría reventado al abrir el dashboard.

- [x] **El DPI se calculaba desde el título de la variante.** `resolvePrintInches`
      caía a un parser que exige el símbolo `″`. Con títulos de puzzle en
      centímetros devolvía `null` **en silencio**, y el estudio de impresión perdía
      la recomendación de upscale y el bleed: se sacaría a producción un máster de
      120 DPI creyendo que está bien. Ahora el orden es `printConfig` → título,
      el parser acepta cm, y hay dos tests que lo fijan.

---

## Qué falta

### Bloqueante para vender

- [x] **1. Migración de Prisma.** Las 66 migraciones heredadas describían el
      schema viejo; se squashearon a una sola `init` (`20260922004355_init`), que
      elimina la arqueología de PBN y POD. Con una Postgres vacía se regenera así:

  ```bash
  cd backend
  rm -rf prisma/migrations
  npx prisma migrate dev --name init
  npm run seed
  ```

  Mientras la Postgres de producción no exista, cualquier ajuste de schema que
  quede por hacer sale gratis repitiendo esos comandos. Congelar la migración
  justo antes del primer deploy.

- [ ] **2. Infraestructura** (todo nuevo, en este orden):
  - [x] Google Cloud: proyecto + OAuth client ID con los orígenes autorizados.
  - [x] Cloudinary: cloud nuevo. `storage.service.ts` organiza por carpetas
        (`asset_folder`) según la clave (`pets/`, `users/`, `styles/`,
        `generations/`, `orders/`), pero sin prefijo de cuenta, así que
        compartir cloud mezclaría los dos negocios en el mismo árbol.
  - [x] fal.ai: se reutiliza la misma cuenta y key (`FAL_KEY`) que
        ClawAndSoul. OpenRouter no tiene key propia: se llama a través de fal
        (`openrouter/router/vision`), así que va en la misma cuenta. El coste
        de las dos marcas sale en la misma factura de fal.ai; `expenses/` de
        cada backend solo ve sus propias generaciones. `MOCK_AI=true` sigue
        sirviendo para desarrollar sin gastar.
  - [x] Tienda Shopify + tokens Storefront y Admin + webhook secret. Tienda
        `puzzlesalvaje.myshopify.com` (su handle antiguo,
        `en-vinculo-arquitectos`, es la misma tienda) con la app "ClawArt",
        cuya config vive en `backend/shopify-app/shopify.app.toml` (scopes y webhooks
        `fulfillment_orders/*`; se publica con
        `shopify app deploy --path backend/shopify-app`). Los webhooks `products/*` y
        `orders/*` están registrados por REST en la tienda. **En el deploy:**
        los 14 webhooks apuntan a ngrok; hay que cambiarlos a
        `api.clawpuzzle.com` (toml + re-registrar los REST).
  - [ ] Dominio + DNS. **Ojo:** la cookie de sesión es `sameSite=lax`, así que el
        front y la API tienen que compartir dominio raíz (`clawpuzzle.com` +
        `api.clawpuzzle.com`). Con `*.vercel.app` + `*.railway.app` el CORS pasa
        pero la sesión no persiste, y el síntoma es confuso: el login "funciona"
        y luego todo da 401.
  - [ ] Railway (backend, **una sola réplica**: BullMQ y cuatro `@Cron` viven en
        el proceso de la API) + Vercel (frontend).

  - [ ] Postgres + Redis. El código ya está listo (`config/redis.config.ts`
        acepta `REDIS_URL` con TLS automático para `rediss://`, y `railway.json`
        corre `migrate:deploy` antes de cada deploy); falta aprovisionar:
    - [ ] Decidir si se re-squashean las migraciones en una sola `init`
          (ahora hay 4). Solo es posible mientras la Postgres de producción
          no exista.
    - [ ] Crear la Postgres (plugin de Railway, en el mismo proyecto que el
          backend).
    - [ ] Crear Redis (plugin de Railway o Upstash; de Upstash, la URL
          `rediss://`, no la REST).
    - [ ] Poner `DATABASE_URL` y `REDIS_URL` en el servicio del backend. Con
          `REDIS_URL` definida, las variables sueltas `REDIS_*` sobran.
    - [ ] Aplicar migraciones (`npx prisma migrate deploy` con la URL de
          producción, o dejar que lo haga el primer deploy).
    - [ ] Sembrar producción: `npm run seed` con `DATABASE_URL`,
          `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
    - [ ] Verificar: arranque sin errores de conexión en los logs (el
          healthcheck no toca DB ni Redis, así que no los detecta), login en
          el admin y un job de BullMQ procesado (p. ej. un sync de productos).

- [x] **3. El producto en Shopify.** `claw-puzzle` tiene una opción,
      `Puzzle theme` (`Perro` | `Gato`), con formato 2:3
      (`ratio_2_3`). El sync (`product-sync.service.ts`) no mira las
      opciones: guarda cada variante por id y título, y todas heredan el
      formato del producto (`ProductReference.formatId`). El `printConfig` de
      las dos variantes (20 × 30 cm, 300 DPI, 3 mm de sangre) lo pone la
      migración `20261019120000_format_ratio_2_3`; el seed no lo cubre (sigue apuntando a
      `custom-pet-puzzle`), así que en una BD nueva hay que ponerlo a mano.

### Necesario antes de abrir al público

- [x] **4. Copy e identidad.** Storefront en español para Ecuador (2026-09-26):
      propuesta "Una pieza de tu mejor amigo para tenerla contigo", la vista
      previa es lo gratis (sin PDF), MDF de 3 mm, 3 días de producción + ~3 de
      entrega, envíos a todo Ecuador. Cubre landing, SEO/OG, `/create`,
      `/user/**`, `/credits`, legales, navbar y footer; precios en `es-EC`.
      El último paso de `/create` (`IAGeneratingStep`) ahora vende el
      rompecabezas con checkout directo a Shopify (antes saltaba a `/studio`,
      que ya no existe), y `GenerationProductCard` hace lo mismo desde el
      detalle del arte. `PersonalizeButton` pasa `variant_id` para no perder
      el tema (Perro | Gato). Pendiente:
  - [x] En Shopify: título, descripción y la opción `Puzzle theme` del
        producto en español (el storefront las muestra tal cual), y el
        idioma del checkout.
        _Hecho cuando:_ `/create` y `/product` muestran título, descripción
        y la opción (nombre y valores `Perro` | `Gato`) en español tras un
        sync de productos, y un checkout de prueba sale entero en español.
  - [x] Las partes que solo se ven con `LAUNCH_MODE` apagado (home completa,
        catálogo, carrito, `/product`, `LandingProducts`, `SimilarSouls`)
        siguen en inglés con copy de canvas/PBN.
        _Hecho cuando:_ con `LAUNCH_MODE` apagado, esas rutas no tienen texto
        en inglés ni mencionan canvas/PBN. Si no se van a usar en el
        lanzamiento, basta con moverlo a post-lanzamiento y marcarlo aquí.
  - [x] Los mensajes de error del backend (p. ej. el 402 de créditos, que
        `useCreateGeneration` detecta por regex) llegan en inglés.
        _Hecho cuando:_ los errores que ve el cliente (generación, créditos,
        subida, auth, checkout) llegan en español, y el CTA a `/credits`
        sigue saliendo con el 402; mejor que lo detecte por el status y no
        por `/out of generation credits/i`, que se rompería al traducir.
  - [x] Legales: revisión profesional (TODO en cada página) y el costo de
        envío sin cifra en `/shipping-returns`.
        _Hecho cuando:_ un profesional revisó `/terms`, `/privacy` y
        `/shipping-returns`, se quitaron los `TODO (legal)` / `TODO
(contenido)` de esas páginas, y `/shipping-returns` da el costo de
        envío y la ventana para reportar daños.
  - [x] `--color-primary-dark` (#367a8f), `--color-text-muted` y el
        `#448da6` de `CreditsBadge` son tonos teal de ClawAndSoul que no
        casan con el primario #292c40.
        _Hecho cuando:_ los dos tokens de `globals.css` (hoy ambos #5c747c)
        salen de la paleta del #292c40, y fuera de `src/app/admin/` no queda
        ningún `#448da6` ni `#367a8f` (hoy: `CreditsBadge` e `IAUploadStep`).
        El admin (Polaris) puede quedarse teal.

- [x] **5. Assets.** `LandingShowcase` ya muestra el rompecabezas impreso
      (`/puzzle/Otto.webp`). Quedan dos, marcados con `TODO(assets)`:
  - [x] La foto del hero (`LandingHero.tsx`): sigue siendo la de ClawAndSoul,
        alguien pintando un PBN. Reemplazarla por una del rompecabezas armado
        y actualizar el `alt`.
  - [x] Un paso de "entrega" en "Cómo funciona" (`StudioLandingPage.tsx`),
        con una imagen del rompecabezas impreso; hoy la entrega va en el texto
        del paso 3.

---

## Riesgos que siguen vivos

**La resolución de impresión es el riesgo técnico de verdad.** Un puzzle de
48×36 cm a 300 DPI son ~24 megapíxeles; fal.ai entrega 1–2. El upscale ×4 de
`image-enhancement.service.ts` existe y está conectado, pero **hay que imprimir
un puzzle real y mirarlo** antes de vender. Un canvas perdona artefactos de
upscale a distancia de pared; un puzzle se mira a 40 cm y encima se corta.
Ya hay una muestra impresa en MDF de 3 mm (2026-09-26); conviene repetir la
prueba con cada estilo nuevo.

**Producir puzzles no es un problema de software.** Impresión en calidad +
troquelado requiere proveedor o maquinaria, y eso es lo que puede invalidar el
precio de venta y con él todo el modelo. Conviene tener una muestra impresa
antes de tocar nada más.

**ClawPuzzle y ClawAndSoul divergen desde el 21 de septiembre.** Un bug que se
arregle en ClawAndSoul no llegará aquí. Es el precio de la copia independiente;
lo caro sería intentar re-sincronizarlos más adelante.

**La máquina de estados está duplicada a propósito.**
`backend/src/orders/production-status.util.ts` y
`frontend/src/entities/admin/lib/` son espejos manuales. Tocar uno sin el otro
produce un admin que ofrece un botón que el backend rechaza con 400.

---

## Trampas heredadas que conviene no tocar

- En `backend/src/main.ts`, `app.use('/api/webhooks/shopify', express.raw(...))`
  **debe** ir antes de `setGlobalPrefix('api')`. Si se reordena, la validación
  HMAC falla en silencio y las órdenes no entran. Es el fallo más caro y más
  difícil de diagnosticar del sistema.
- El `@font-face` de Material Symbols vive dentro de `@layer base` en
  `globals.css` a propósito: movido a un `<link>`, el CSS de Google sin capa fija
  los iconos en 24px.
- `Format.width`/`height` son **píxeles de generación**, no el tamaño físico.
  El tamaño físico está en `ProductFormatVariant.printConfig` (`widthCm`/`heightCm`).
  Un `Format` es solo la proporción de la imagen generada.
