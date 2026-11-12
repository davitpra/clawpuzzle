# Despliegue del backend (Railway)

El backend **no puede ir en serverless**. Los workers de BullMQ y los cinco
`@Cron` (sync de Shopify cada 6 h, órdenes cada 10 min, limpieza de tokens a las
3 AM, ciclo de vida de cuentas a las 4 AM, purga de invitados a las 5 AM) corren
dentro del mismo proceso que la API, así que necesita un contenedor siempre
encendido.

## Reparto de dominios

| Host | Sirve | Alojado en |
| --- | --- | --- |
| `clawpuzzle.com` | storefront Next.js — **canónico**, `www` redirige aquí | Vercel |
| `api.clawpuzzle.com` | esta API | Railway |
| `shop.clawpuzzle.com` | Shopify — **dominio principal**, aquí vive el checkout | Shopify |
| `staging.clawpuzzle.com` | preview del frontend, atado a una rama | Vercel |

Todo cuelga del mismo dominio raíz a propósito: es lo que permite que la cookie
de sesión (`httpOnly`, `sameSite=lax`, `COOKIE_DOMAIN=.clawpuzzle.com`) viaje
entre el frontend y la API, y que el cliente no salte a un dominio ajeno al
pagar. Con `*.vercel.app` + `*.railway.app` el CORS pasa pero la sesión no
persiste, y el síntoma es confuso: el login "funciona" y luego todo da 401.

Cuál de los dos hosts del storefront es el canónico **no es indiferente**:
`FRONTEND_URL` se compara contra la cabecera `Origin` por igualdad exacta, y
`clawpuzzle.com` y `www.clawpuzzle.com` son orígenes distintos. Si en Vercel
se marca `www` como principal (es el default que propone al añadir el dominio) y
aquí sigue el apex, el navegador acaba en `www` y **todas** las llamadas a la
API mueren con un error de CORS. El mismo desajuste rompe el login de Google,
que valida el origen de la página contra los *Authorized JavaScript origins*.
Síntoma: el apex responde `308` hacia `www`, y un `curl -H "Origin: …"` contra
la API devuelve la cabecera `access-control-allow-origin` para un host y no para
el otro.

El checkout de Shopify **no se puede alojar en dominio propio**: siempre lo
sirve Shopify en el dominio principal de la tienda. Por eso Shopify vive en el
subdominio `shop.` y no en la raíz; si no se conecta ningún dominio, el checkout
sale en `puzzlesalvaje.myshopify.com`. El código no depende de ese dominio: el
frontend usa `cart.checkoutUrl` tal cual lo devuelve `cartCreate`, y
`SHOPIFY_STORE_DOMAIN` sigue apuntando al `.myshopify.com` (el endpoint de la
Storefront API es independiente del dominio principal).

Registros DNS (en el campo Host va solo el subdominio, sin `.clawpuzzle.com`):

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | el IP que muestre Vercel para el proyecto |
| CNAME | `www` | el `*.vercel-dns-0XX.com` del proyecto |
| CNAME | `staging` | el mismo `*.vercel-dns-0XX.com` (opcional, ver más abajo) |
| CNAME | `shop` | `shops.myshopify.com` |
| CNAME | `api` | `xxxx.up.railway.app` |
| TXT | el que indique Railway | valor de verificación de Railway |

Los dos registros de Railway (CNAME **y** TXT) son obligatorios: sin el TXT no
verifica el dominio y `api.clawpuzzle.com` devuelve 404 aunque el CNAME esté
bien. Vercel asigna valores por proyecto, así que hay que copiarlos del
dashboard en vez de usar los `76.76.21.21` / `cname.vercel-dns.com` de los
tutoriales antiguos.

Orden para el lado de Shopify:

1. Shopify → *Settings → Domains* → conectar `shop.clawpuzzle.com`.
2. DNS → CNAME `shop` → `shops.myshopify.com`.
3. Shopify verifica → **Set as primary**.
4. Desplegar el frontend en Vercel y apuntar `@` + `www` allí. Si la raíz
   estaba conectada a Shopify, aquí se borra su A (`23.227.38.65`) y después se
   quitan `clawpuzzle.com` y `www.clawpuzzle.com` de *Domains* en Shopify.
5. Subir al Online Store un tema mínimo que redirija todo a `clawpuzzle.com`
   salvo las rutas de checkout, para que los enlaces de vuelta del checkout
   ("continue shopping", el logo) no lleven a una tienda Shopify paralela.
6. Quitar la contraseña de la tienda. **No se puede lanzar con ella puesta**:
   con la tienda protegida, los enlaces de checkout de la Storefront API
   redirigen a la página de password y no se puede pagar.

Efecto secundario a asumir: Shopify tratará `shop.` como dominio principal para
todo — enlaces de los emails de confirmación de pedido, sitemap y URLs que
generen las apps.

## 0. Antes del primer deploy

- **Migraciones**: decidir si se re-squashean en una sola `init`. Solo es
  posible mientras la Postgres de producción no exista; después quedan
  congeladas.
- **Memoria**: el plan tiene que dar al menos **1 GB**. `geoip-lite` carga su
  base entera en RAM (~100 MB) la primera vez que se resuelve una IP, y `sharp`
  suma su propio pico.

## 1. Servicios en Railway

Crea un proyecto y dentro tres servicios:

1. **Postgres** (*+ New → Database → PostgreSQL*) → expone `DATABASE_URL`
   (red privada). `DATABASE_PUBLIC_URL` solo existe si se activa el TCP proxy
   (*Settings → Networking → TCP Proxy*, puerto 5432); hace falta para cargar
   datos desde fuera (ver "Datos iniciales").
2. **Redis** (*+ New → Database → Redis*) → expone `REDIS_URL`.
3. **Backend**: *+ New → Empty Service*. Se configura entero (settings y
   variables) **antes** de conectarle el repo, porque conectar el repo lanza el
   primer deploy.

El repo es un monorepo (`backend/` + `frontend/`), así que en *Settings* del
servicio backend hay que fijar:

- **Root Directory**: `backend`.
- **Watch Paths**: `/backend/**`, para que un commit que solo toca el frontend
  no redespliegue la API.
- **Wait for CI**: activado, para que solo despliegue si pasa
  `.github/workflows/ci.yml`.
- **Build y deploy**, a mano en el servicio (mismos valores que `railway.json`):
  - builder: Railpack (default)
  - build: `npm run build`
  - pre-deploy: `npm run migrate:deploy` (aplica migraciones antes de cambiar
    de versión; si falla, el deploy se aborta y sigue vivo el release anterior)
  - start: `npm run start:prod`
  - healthcheck: `/api/health`, timeout 120 s
  - restart: `ON_FAILURE`, 10 reintentos
  - réplicas: 1 — **no lo subas**: con dos réplicas los crons se ejecutan
    duplicados.

Por qué a mano y no con `railway.json`: Railway deprecó *Config as Code*. Ya
no deja fijar un *config file path* nuevo (la API responde "Config as Code …
is deprecated"), y sin esa ruta no encuentra `backend/railway.json` desde un
monorepo. Los archivos existentes solo funcionan hasta el **2026-12-01**; el
reemplazo es *Infrastructure as Code* (`.railway/railway.ts`, `railway config
migrate`). `railway.json` queda en el repo como referencia de los valores.

Después, *Settings → Source → Connect Repo* → `davitpra/clawpuzzle`, rama
`main`.

## 2. Variables de entorno

En el servicio backend (*Variables → Raw Editor*), referencia las de los otros
dos servicios con la sintaxis de Railway y añade el resto:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

NODE_ENV=production
FRONTEND_URL=https://clawpuzzle.com      # sin barra final; admite lista con comas
APP_PUBLIC_URL=https://api.clawpuzzle.com

COOKIE_DOMAIN=.clawpuzzle.com
COOKIE_SAMESITE=lax

JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<otro distinto>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...       # canjea el código en POST /auth/google/code
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
FAL_KEY=...                    # OpenRouter se llama a través de fal, sin key propia
MOCK_AI=false                  # ¡crítico! con true devuelve la foto sin generar

WEBHOOK_SECRET=<openssl rand -base64 32>
SHOPIFY_ADMIN_API_URL=https://puzzlesalvaje.myshopify.com/admin/api/2026-07
SHOPIFY_ADMIN_API_TOKEN=shpat_...
SHOPIFY_WEBHOOK_SECRET=...

ACCOUNT_LIFECYCLE_ENABLED=true
INACTIVITY_MONTHS=24
```

`PORT` no se define: Railway lo inyecta y `main.ts` escucha en `0.0.0.0` sobre
ese puerto. Si se fija a mano, el *target port* del dominio tiene que coincidir.

`SHOPIFY_ADMIN_API_URL` lleva la misma versión que `webhooks.api_version` en
`shopify-app/shopify.app.toml`, **no** la del `.env` local (sigue en `2024-01`,
ya retirada: Shopify responde con la versión soportada más antigua sin avisar).
Usa el dominio `puzzlesalvaje.myshopify.com` y no el handle antiguo
`en-vinculo-arquitectos`, aunque ambos apunten a la misma tienda.

`SHOPIFY_WEBHOOK_SECRET` es el **client secret de la app ClawArt**, y el
`shpat_` de `SHOPIFY_ADMIN_API_TOKEN` tiene que ser un token de esa misma app.
Shopify firma cada webhook con el secreto de la app que lo creó, y aquí hay dos
orígenes: los `products/*` y `orders/*` que el backend registra por REST con el
`shpat_`, y los `fulfillment_orders/*` del `shopify.app.toml`. El guard
(`shopify-hmac.guard.ts`) solo acepta un secreto; si el token fuera de otra app,
uno de los dos grupos llegaría con otra firma y respondería 401 sin que nada más
falle.

`REDIS_HOST/PORT/PASSWORD` no hacen falta: si `REDIS_URL` está definida manda
ella (`src/config/redis.config.ts`). El Redis de Railway entrega un `redis://`
por la red privada; con un proveedor externo como Upstash hay que usar la URL
`rediss://` (no la REST), y ese esquema activa TLS automáticamente.

Swagger queda apagado en producción. Para abrirlo puntualmente:
`SWAGGER_ENABLED=true` (recuerda quitarlo — `/api/docs` no pide credenciales).

### Entorno de staging (y por qué los previews de Vercel no valen)

`FRONTEND_URL` acepta varios orígenes separados por comas:

```bash
FRONTEND_URL=https://clawpuzzle.com,https://staging.clawpuzzle.com
```

Los preview deployments de Vercel **no se pueden autorizar** por mucho que se
listen: cada deploy sale en un `*.vercel.app` distinto e irrepetible, y aunque
se abriera el CORS a todos ellos la sesión seguiría sin funcionar. `vercel.app`
es otro sitio a ojos del navegador, así que la cookie `sameSite=lax` que emite
`auth.controller.ts` se descarta al recibirla y no se manda en las siguientes
peticiones. El fallo es silencioso: el catálogo y las fichas de producto cargan
(esos datos vienen de Shopify), el `POST /auth/login` devuelve 200, y el usuario
sigue sin sesión.

La salida es no depender de las URLs efímeras: en Vercel → *Settings → Domains*
se añade `staging.clawpuzzle.com` atado a una rama concreta (disponible en
todos los planes). Al colgar del dominio raíz, la cookie funciona sin tocar
`sameSite` y aquí solo hay que sumar un origen fijo. Con plan Pro se puede ir más
lejos y poner un wildcard `*.preview.clawpuzzle.com` como *preview suffix*, que
da un entorno por PR con las mismas garantías.

Lo que **no** hay que hacer es abrir `*.vercel.app` con `COOKIE_SAMESITE=none`:
eso manda la cookie de sesión en peticiones cross-site desde cualquier web,
tirando la protección CSRF que hoy sale gratis, sobre un dominio público donde
cualquiera despliega. Además las cookies de terceros están en retirada en los
navegadores.

## 3. Primer deploy

Al lanzar el deploy, el orden es `npm ci` → `nest build` →
`prisma migrate deploy` → arranque → healthcheck. Si el pre-deploy falla, el
deploy se aborta.

Un deploy en verde **no** garantiza que Postgres y Redis conecten: el
healthcheck no los toca a propósito (una caída pasajera de la base reiniciaría
el contenedor en bucle). Hay que leer los logs de arranque.

## 4. Dominio

En *Settings → Networking* del servicio backend, añade el custom domain
`api.clawpuzzle.com` y crea en el DNS los dos registros que indique Railway
(CNAME y TXT).

## 5. Después del primer deploy

1. **Datos iniciales** (solo la primera vez). Producción se inició con el
   catálogo de desarrollo, no con el seed (ver "Datos iniciales" más abajo).
   Si alguna vez se parte de una base vacía, el seed se lanza en local contra
   `DATABASE_PUBLIC_URL`: `railway run` ejecuta en la máquina local y el
   `DATABASE_URL` del servicio (`*.railway.internal`) no resuelve desde fuera.

   ```bash
   cd backend
   DATABASE_URL="<DATABASE_PUBLIC_URL>" ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run seed
   ```

   Sin `ADMIN_EMAIL` y `ADMIN_PASSWORD` el seed se salta el usuario admin.
2. **`printConfig` del producto**: el seed no lo cubre. Si se parte del seed,
   hay que ponerlo a mano desde el admin en las dos variantes de `claw-puzzle`
   (29,7 × 42 cm, 300 DPI, 3 mm de sangre). Con el catálogo de desarrollo ya
   viene puesto.
3. **Webhooks de Shopify registrados por REST** (`products/*`, `orders/*`,
   `fulfillment_orders/*`): se registran solos al arrancar contra
   `APP_PUBLIC_URL`, pero el registro no mueve los que ya existen con otra
   dirección: los de desarrollo (ngrok) seguirían vivos y se crearía un
   duplicado por topic. Mejor repuntarlos por API **antes** de poner
   `APP_PUBLIC_URL` (el admin de Shopify no lista los creados por API); así el
   arranque recibe `422` (ya existe, se loguea en debug) y no crea nada:

   ```bash
   curl -H "X-Shopify-Access-Token: $TOKEN" "$SHOPIFY_ADMIN_API_URL/webhooks.json"
   curl -X PUT -H "X-Shopify-Access-Token: $TOKEN" -H 'Content-Type: application/json' \
     "$SHOPIFY_ADMIN_API_URL/webhooks/<id>.json" \
     -d '{"webhook":{"id":<id>,"address":"https://api.clawpuzzle.com/api/webhooks/shopify/..."}}'
   ```

   Estado esperado: 14 webhooks, todos en `https://api.clawpuzzle.com`. Hecho
   así el 2026-09-30.
4. **Webhooks de la app de Shopify**: en `shopify-app/shopify.app.toml`, cambiar
   las cinco `uri` de `fulfillment_orders/*` de ngrok a
   `https://api.clawpuzzle.com/...` y publicar desde la raíz del repo:

   ```bash
   shopify app deploy --path backend/shopify-app
   ```
5. **Google OAuth**: añade `https://clawpuzzle.com` a *Authorized JavaScript
   origins* en Google Cloud Console.
6. **Frontend**: en Vercel (*Settings → Environment Variables*):

   ```bash
   NEXT_PUBLIC_API_URL=https://api.clawpuzzle.com/api
   SHOPIFY_STORE_DOMAIN=https://puzzlesalvaje.myshopify.com
   SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
   NEXT_PUBLIC_SHOPIFY_STORE_SLUG=puzzlesalvaje
   ```

   Sin las dos de Shopify el catálogo no carga. El slug arma los enlaces del
   admin a `admin.shopify.com/store/<slug>`; las `NEXT_PUBLIC_*` se incrustan en
   el build, así que cambiarlas exige redesplegar.

## 6. Comprobaciones

```bash
curl https://api.clawpuzzle.com/api/health          # 200 {"status":"ok",...}
curl -i https://api.clawpuzzle.com/api/docs         # 404 en producción
curl -i -H "Origin: https://clawpuzzle.com" \
  https://api.clawpuzzle.com/api/health             # trae access-control-allow-origin
```

- Logs de arranque sin errores de conexión a Postgres ni a Redis.
- En el navegador: login → recargar la página. Si la sesión se pierde al
  recargar, el problema es la cookie: revisa `COOKIE_DOMAIN` y que el frontend
  haga las peticiones con `credentials: 'include'`.
- Un job de BullMQ procesado: lanzar un sync de productos desde el admin.
- Una generación real, para confirmar `MOCK_AI=false` y `FAL_KEY`.

## Datos iniciales

Producción arrancó (2026-09-30) con el catálogo de la base de desarrollo, no
con el seed: formatos, productos y variantes (con su `printConfig`), packs de
créditos, estilos con sus imágenes, configs de imagen y visión, tarifas de
proveedores y el usuario admin (con créditos a 0). Se dejaron fuera usuarios de
prueba, pets, generaciones, pedidos, créditos, sesiones, audit logs, sync logs,
carritos y gastos.

El procedimiento, por si hay que repetirlo contra una Postgres vacía:

1. Copiar la base de desarrollo a una temporal local y recortarla ahí (nunca
   sobre la de desarrollo):
   ```sql
   truncate audit_logs, refresh_tokens, expenses, generations, sync_logs,
     pet_photos, order_events, order_items, orders, pets, credit_transactions,
     cart_items, carts restart identity cascade;
   delete from users where role <> 'admin';
   ```
2. `pg_dump --no-owner --no-acl --format=custom` de la temporal. Incluye
   `_prisma_migrations`, así que el esquema tiene que estar al día y sin drift
   (`npx prisma migrate status` / `migrate diff`).
3. `pg_restore --no-owner --no-acl --exit-on-error --single-transaction -d
   "<DATABASE_PUBLIC_URL>"` **antes** del primer deploy del backend. Así el
   pre-deploy encuentra las migraciones aplicadas ("No pending migrations to
   apply") en vez de crear un esquema vacío que choque con el restore.

## Problemas conocidos del build

- **`npm ci` falla con ERESOLVE**: pasaba porque `@nestjs/config`, `jwt`,
  `passport` y `swagger` seguían en la línea de NestJS 10 con el core en 11. En
  local se instalaban igual por el lockfile; `npm ci` revalida los peers y aborta.
  Resuelto subiéndolos a config 4 / jwt 11 / passport 11 / swagger 11.
- **`nest: not found` o `prisma: not found` en el build**: Railway inyecta las
  variables del servicio también en el build, así que `NODE_ENV=production` hace
  que npm omita las devDependencies. El `.npmrc` del repo (`include=dev`) lo
  neutraliza; no lo borres.
- **`npm ci` falla con EUSAGE y "Missing: react … from lock file"**: el CLI de
  prisma depende de `@prisma/studio-core`, que declara `react`, `react-dom` y
  `@types/react` como peers no opcionales; npm los instala solos. Un
  `legacy-peer-deps=true` en el `~/.npmrc` de quien desarrolle los omite del
  lockfile y el deploy revienta. El `.npmrc` del repo fuerza
  `legacy-peer-deps=false` para que el lock salga siempre igual. Si vuelve a
  aparecer, regenera el lock con `npm install` y commítealo.
- **La app no arranca por `JWT_ACCESS_SECRET is required in production`**: es
  intencional. Sin la variable, los tokens se firmarían con el placeholder
  público del repo y cualquiera podría fabricar sesiones.
- **El build no encuentra `package.json`**: falta el Root Directory
  (`backend`) en *Settings* del servicio.
- **El deploy no aplica migraciones o no tiene healthcheck**: los comandos de
  build y deploy no están puestos en el servicio. `railway.json` no se lee (ver
  "Servicios en Railway").

## Notas de mantenimiento

- **Migraciones**: se aplican en el pre-deploy. Una migración destructiva se
  ejecuta *antes* de que arranque el código nuevo, así que las migraciones que
  borran o renombran columnas deben ir en dos deploys (primero código
  compatible, después el borrado).
- **Rollback**: Railway revierte el contenedor, pero **no** las migraciones. Si
  necesitas volver atrás, escribe la migración inversa.
- **Logs de crons**: el sync de órdenes cada 10 min es el más ruidoso; sirve de
  latido para confirmar que las colas conectan con Redis.
