# ClawPuzzle — estado del proyecto

Ecommerce de rompecabezas personalizados, derivado de ClawAndSoul. El cliente
sube la foto de su mascota, genera arte con IA y lo compra impreso como puzzle.

Última actualización: 2026-09-21.

> Las casillas son listas de tareas de Markdown: `- [ ]` pendiente, `- [x]`
> hecho. Se marcan clicando en la vista previa de VS Code, o con `Alt+C` sobre
> la línea si tienes la extensión _Markdown All in One_.

---

## Qué está hecho

- [x] **Fase 0 — copia y saneamiento.** `backend/` y `frontend/` son dos repos
      git independientes, clonados de ClawAndSoul con su historia completa (152 y
      391 commits) y **sin remotos**: no pueden empujar al original por accidente.
      Renombrado de marca aplicado en 41 archivos de código, nombres de paquete
      (`clawpuzzle-api`, `clawpuzzle-web`), título de Swagger y clave de
      localStorage del carrito (`clawpuzzle_cart`).

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
  - `podConfig` → `printConfig` (`{widthCm, heightCm, bleedMm, safeMarginMm, minDpi}`).
  - `productionStatus` gana `packed` entre `printed` y `shipped`: troquelar,
    contar piezas y encajar es un paso físico real. Queda **una sola** máquina
    de estados (la de accesorios desapareció).
  - `PuzzlePieceOverlay` sustituye a `CanvasEdgeOverlay` en los siete puntos del
    storefront que consumían el eje `FrameStyle`.

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
      120 DPI creyendo que está bien. Ahora el orden es `printConfig` → `Format` →
      título, el parser acepta cm, y hay tres tests que lo fijan.

---

## Qué falta

### Bloqueante para vender

- [x] **1. Migración de Prisma.** El schema está editado y validado, pero las 66
      migraciones heredadas describen el schema viejo. Con una Postgres vacía:

  ```bash
  cd backend
  rm -rf prisma/migrations
  npx prisma migrate dev --name init
  npm run seed
  ```

  Squashear a una sola `init` vale la pena: elimina la arqueología de PBN y POD,
  y hace gratis cualquier ajuste de schema que quede por hacer. Congelarla
  justo antes del primer deploy.

- [ ] **2. Infraestructura** (todo nuevo, en este orden):
  - [ ] Dominio + DNS. **Ojo:** la cookie de sesión es `sameSite=lax`, así que el
        front y la API tienen que compartir dominio raíz (`clawpuzzle.com` +
        `api.clawpuzzle.com`). Con `*.vercel.app` + `*.railway.app` el CORS pasa
        pero la sesión no persiste, y el síntoma es confuso: el login "funciona"
        y luego todo da 401.
  - [ ] Google Cloud: proyecto + OAuth client ID con los orígenes autorizados.
  - [ ] Postgres + Redis.
  - [ ] Cloudinary: cloud nuevo. `storage.service.ts` sube a la raíz sin prefijo
        de cuenta, así que compartir cloud mezclaría los dos negocios en el
        mismo árbol.
  - [ ] fal.ai / OpenRouter: keys nuevas si quieres que `expenses/` separe los
        costes de las dos marcas. Mientras tanto `MOCK_AI=true` permite
        desarrollar sin gastar.
  - [ ] Tienda Shopify + tokens Storefront y Admin + webhook secret.
  - [ ] Railway (backend, **una sola réplica**: BullMQ y cuatro `@Cron` viven en
        el proceso de la API) + Vercel (frontend).

- [ ] **3. El producto en Shopify.** Un producto puzzle con **una sola opción** de
      variante. `product-sync.service.ts` solo lee `variant.option1`: si defines
      dos opciones, la segunda se ignora y las variantes se saltan con un `warn`,
      dejando la ficha sin tallas y sin error visible. Los valores de esa opción
      tienen que coincidir con `Format.shopifyVariantOption` del seed
      (`300 pieces`, `500 pieces`, `1000 pieces`).

### Necesario antes de abrir al público

- [ ] **4. Copy e identidad.** El storefront sigue con los textos de ClawAndSoul:
      `widgets/studio-landing/**` habla de paint-by-numbers y canvas, y
      `product-templates/model/processSteps.ts` describe el flujo viejo. Es
      contenido de marketing (promesas, precios), así que es una decisión de
      negocio más que técnica. La paleta se cambia en `src/app/globals.css` (todos
      los tokens de Tailwind v4 viven ahí, no hay config file).

- [ ] **5. Assets.** `public/studio/`, `public/landing/` y `public/process/` son
      imágenes de PBN y canvas.

- [ ] **6. El selector de piezas y la referencia de escala.** `ProductSizeSelector`
      funciona, pero muestra el formato genérico. Conviene que enseñe
      "500 pieces · 48 × 36 cm" y, junto al mockup, algo que dé idea del tamaño
      real del puzzle montado.

---

## Riesgos que siguen vivos

**La resolución de impresión es el riesgo técnico de verdad.** Un puzzle de
48×36 cm a 300 DPI son ~24 megapíxeles; fal.ai entrega 1–2. El upscale ×4 de
`image-enhancement.service.ts` existe y está conectado, pero **hay que imprimir
un puzzle real y mirarlo** antes de vender. Un canvas perdona artefactos de
upscale a distancia de pared; un puzzle se mira a 40 cm y encima se corta.

**Producir puzzles no es un problema de software.** Impresión en calidad +
troquelado requiere proveedor o maquinaria, y eso es lo que puede invalidar el
precio de venta y con él todo el modelo. Conviene tener una muestra impresa
antes de tocar nada más.

**Los dos repos divergen desde hoy.** Un bug que se arregle en ClawAndSoul no
llegará aquí. Es el precio de la copia independiente; lo caro sería intentar
re-sincronizarlos más adelante.

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
  El tamaño físico está en `printWidthCm`/`printHeightCm`. En ClawAndSoul esa
  ambigüedad era inofensiva porque nadie calculaba con esos números; aquí sí.
