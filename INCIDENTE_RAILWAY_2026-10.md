# Incidente de Railway (21-oct-2026): plan de respuesta

## 1. Contexto

El **21-oct-2026** Railway detectó acceso no autorizado a los sistemas donde
guarda las variables de entorno de sus clientes. Según su aviso, el atacante
pudo acceder a variables cifradas y obtuvo **descifrado un subconjunto**.

Qué hizo Railway por su cuenta:

- Pausó los builds en todas las regiones y los reactiva por niveles:
  Enterprise → Pro → **Hobby** → Free/Trial.
- Invalidó **todos los tokens de API**, parte de las sesiones OAuth (el CLI
  pide `railway login` otra vez), la **integración con GitHub** y las
  credenciales de los buckets.
- Pide a todos los clientes **rotar todas las variables** (API keys,
  credenciales de BD, registros privados) y revisar los logs.
- Vincula el ataque con una campaña contra plataformas cuyo objetivo es robar
  claves de **proveedores de inferencia de IA**.

El backend de ClawPuzzle vive en Railway: proyecto `Claw Puzzle`
(`e047bb01-…`), entorno `production` (`381e6a37-…`), servicios `backend`,
`Postgres` y `Redis`. **Todos sus secretos se tratan como filtrados.**

Objetivo:

1. Cortar cualquier acceso del atacante.
2. Rotar cada secreto sin dejar producción caída.
3. Comprobar si hubo abuso y corregirlo.

Fuentes:

- [Railway Status](https://status.railway.com)
- [GitGuardian: Treat Every Env Variable as Exposed](https://blog.gitguardian.com/railway-october-2026-incident-environment-variables/)
- [The CyberSec Guru: Railway Security Breach](https://thecybersecguru.com/news/railway-security-breach-environment-variables/)
- [Shopify: Manage your app credentials](https://shopify.dev/docs/apps/build/authentication-authorization/manage-credentials)
- [Railway Station: rotar DATABASE_URL](https://station.railway.com/questions/need-to-rotate-my-database-url-f7e75160)

## 2. Inventario: qué expone cada secreto

Las variables del servicio `backend` se comprobaron el 22-oct (solo los
nombres, nunca los valores).

| Secreto (Railway) | Qué puede hacer un atacante | Prioridad |
| --- | --- | --- |
| Postgres (`DATABASE_URL`; antes también `DATABASE_PUBLIC_URL` con el **TCP proxy público** `nozomi.proxy.rlwy.net:17269`) | Leer o modificar toda la BD: usuarios, emails, pedidos, créditos, rol admin | P0 |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Firmar un JWT con `role: admin` y usar toda la API de admin | P0 |
| `SHOPIFY_ADMIN_API_TOKEN` (`shpat_` de la app ClawArt, scopes `read/write_orders`, `read_products`, fulfillment) | Leer pedidos y datos de clientes, modificar pedidos | P0 |
| `SHOPIFY_WEBHOOK_SECRET` (client secret de ClawArt) | Forjar webhooks firmados: pedidos falsos que dan créditos gratis | P0 |
| `FAL_KEY` (también paga OpenRouter a través de fal) | Gastar el saldo de IA. Es el objetivo declarado de la campaña | P0 |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Leer o borrar fotos de mascotas y masters de impresión | P1 |
| `GOOGLE_CLIENT_SECRET` | Canjear códigos OAuth haciéndose pasar por la app | P1 |
| Redis (`REDIS_URL`, solo red privada) | Inyectar o borrar jobs de BullMQ (requiere estar dentro de la red privada) | P1 |
| `WEBHOOK_SECRET` | Llamar a `POST /api/webhooks/generation-complete` y marcar generaciones como completadas con URLs arbitrarias. Hoy no lo llama ningún servicio externo | P1 |

No son secretos y no se tocan: `NODE_ENV`, `FRONTEND_URL`, `APP_PUBLIC_URL`,
`COOKIE_DOMAIN`, `COOKIE_SAMESITE`, `JWT_*_EXPIRES_IN`, `GOOGLE_CLIENT_ID`,
`CLOUDINARY_CLOUD_NAME`, `SHOPIFY_ADMIN_API_URL`, `MOCK_AI`,
`OPENROUTER_DEFAULT_MODEL`, `ACCOUNT_LIFECYCLE_ENABLED`, `INACTIVITY_MONTHS`.

Fuera del alcance:

- **Frontend (Vercel):** no está en Railway. Su
  `SHOPIFY_STOREFRONT_ACCESS_TOKEN` no está afectado.
- **`.env` local:** no usa credenciales de producción.
- **CI (`.github/workflows/ci.yml`):** no usa tokens de Railway, así que no
  hay nada que recrear.

## 3. Decisiones

- **Plan Hobby:** los builds siguen pausados, así que no se puede desplegar.
- **Contener sin caída** ahora y hacer la rotación completa en cuanto vuelvan
  los builds de Hobby. Revocar una clave sin desplegar la nueva tumbaría la
  generación, Shopify o la BD.
- **Las claves nuevas de terceros** (fal, Cloudinary, Google, Shopify) van
  **directamente del panel del proveedor a Railway → Variables**. Nunca pasan
  por el chat ni por archivos del repo.
- **Los secretos aleatorios** (JWT, `WEBHOOK_SECRET`) se generan con
  `openssl` dentro del mismo comando que los guarda, sin imprimirlos.

## 4. Fase A: contención inmediata (sin deploy)

### A1. Renovar la sesión del CLI ✅

Desde WSL el navegador que se abre es el de Linux, así que se usa el modo sin
navegador y se abre la URL en el Chrome de Windows:

```bash
railway login --browserless
```

### A2. Cerrar el acceso público a la BD ✅

Ruta en el dashboard: Postgres → Settings → Networking → TCP Proxy → borrar.
Lo mismo en Redis.

Verificación:

```bash
# Debe devolver "tcpProxies": [] para Postgres y para Redis
railway api 'query { tcpProxies(environmentId: "<ENV_ID>", serviceId: "<SERVICE_ID>") { id domain proxyPort } }'
```

Probe con el protocolo de Postgres (SSLRequest): **sin proxy**, Railway corta
la conexión sin responder; **con proxy**, Postgres respondería `S` o `N`.

### A3. Revisar consumo y abuso en cada panel (pendiente)

Desde el **30-sep-2026** (lanzamiento):

- [ ] **fal.ai:** uso y facturación por día. Si el panel lo permite, poner
      un tope de gasto o una alerta. Es la prioridad.
- [ ] **Cloudinary:** uso y Media Library (assets nuevos o borrados).
- [ ] **Shopify:** pedidos recientes, apps instaladas y staff de la tienda.
- [ ] **Railway:** Workspace → Audit Logs (miembros nuevos, tokens, cambios
      de variables). Los reseteos de credenciales de buckets que hizo un
      empleado de Railway son esperados.
- [ ] **Email:** ver si llegó el aviso de Railway a los clientes afectados.
- [x] **GitHub:** no hay deploy keys ni webhooks, el único colaborador es
      `davitpra` y los commits de `main` son legítimos (último: `74bb78b`).

### A4. Forense en la BD, solo lectura (pendiente)

Requisito: registrar una clave SSH en Railway (`railway ssh keys add`). Se
ejecuta dentro del contenedor del backend por la red privada, sin proxy ni
build, con `pg` (ya es dependencia) y la sesión en
`default_transaction_read_only = on`.

| Consulta | Qué indicaría abuso |
| --- | --- |
| `users` con `role='admin'` | Un admin que no conoces |
| Altas de `users` por día desde el 30-sep | Un pico anómalo de registros |
| `credit_transactions` con `admin_grant`, `pack_purchase` u `order_bonus` desde el 30-sep | Créditos sin pedido real detrás |
| `orders` desde el 30-sep, cruzado con la lista de pedidos de Shopify | Un pedido que no existe en Shopify (webhook forjado) |
| `generations` con `result_url` fuera de `https://res.cloudinary.com/` | Abuso de `generation-complete` |
| `generations` por día desde el 15-oct | Un volumen anómalo (gasto de fal) |
| `order_events` y `audit_logs` recientes | Acciones de admin que no hiciste tú |

## 5. Fase B: rotación (cuando vuelvan los builds de Hobby)

**Cuándo empezar:** cuando [status.railway.com](https://status.railway.com)
anuncie builds para Hobby, o cuando *Ctrl/Cmd+K → Deploy Latest Commit*
funcione en el servicio `backend`.

**Duración estimada:** 30 a 45 minutos. Antes de empezar, ten abiertos los
paneles de fal, Cloudinary, Google Cloud, Shopify Dev Dashboard y Railway.

**Orden general:** se crea la credencial nueva sin revocar la vieja → se
guardan todas las variables nuevas en Railway sin desplegar → se rotan
Postgres y Redis → **un solo deploy** → verificación (fase C) → se revocan
las viejas (fase D).

### B0. Preparación

1. Railway → `backend` → Settings → **Source**: el repo
   `davitpra/clawpuzzle` (rama `main`) tiene que seguir conectado. Railway
   cortó la integración con GitHub; si aparece desconectado, reconectar.
2. Mientras se cargan variables, **no aplicar ni desplegar** los cambios
   pendientes que Railway vaya acumulando. Se aplican todos juntos en B5.

### B1. Secretos internos (los ejecuta Claude)

Se generan y guardan sin imprimirse:

```bash
cd backend
railway variables --service backend --skip-deploys \
  --set "JWT_ACCESS_SECRET=$(openssl rand -base64 48)" \
  --set "JWT_REFRESH_SECRET=$(openssl rand -base64 48)" \
  --set "WEBHOOK_SECRET=$(openssl rand -base64 32)"
```

- **JWT:** todas las sesiones dejan de valer y todos los usuarios (admin
  incluido) vuelven a iniciar sesión. Los refresh tokens viejos fallan por
  firma, así que no hace falta tocar `refresh_tokens`.
- **`WEBHOOK_SECRET`:** ningún servicio externo lo usa, así que no hay que
  actualizarlo en ningún otro sitio.

### B2. Claves de terceros (las hace el dueño de cada panel)

Cada valor nuevo se pega en **Railway → `backend` → Variables**. La clave
vieja **no** se borra todavía.

| Proveedor | Dónde | Variables en Railway |
| --- | --- | --- |
| fal.ai | Dashboard → API Keys → crear una clave nueva | `FAL_KEY` |
| Cloudinary | Settings → API Keys → *Generate new API key* | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Google Cloud | APIs & Services → Credentials → cliente OAuth web → *Add secret* | `GOOGLE_CLIENT_SECRET` (el `GOOGLE_CLIENT_ID` no cambia) |

### B3. Shopify: app ClawArt (lo más delicado, límite de 1 hora)

1. Shopify **Dev Dashboard** → app **ClawArt** → Settings → Credentials →
   **Rotate**. Aparece un client secret nuevo (etiqueta *New*) y un
   **refresh token válido 1 hora**.
2. En **tu propia terminal** (no en el chat), re-ancla el token de la tienda
   al secret nuevo. Los valores se piden con `read -s` para que no queden en
   el historial:

   ```bash
   read -rsp 'Client secret NUEVO: ' CS; echo
   read -rsp 'Refresh token: ' RT; echo
   read -rsp 'shpat_ ACTUAL (Railway → SHOPIFY_ADMIN_API_TOKEN): ' AT; echo
   curl -sS -X POST 'https://puzzlesalvaje.myshopify.com/admin/oauth/access_token' \
     -H 'Content-Type: application/json' \
     -d "$(jq -n --arg cs "$CS" --arg rt "$RT" --arg at "$AT" \
           '{client_id:"b9d390fe2cf5930a35062fdd9493b0cf", client_secret:$cs, refresh_token:$rt, access_token:$at}')" \
     | jq -r '.access_token // .'
   unset CS RT AT
   ```

   La respuesta trae el `shpat_` **nuevo**. El viejo queda destruido en ese
   momento: a partir de aquí el backend desplegado no puede llamar a la Admin
   API hasta el deploy de B5, así que conviene hacer B3 justo antes de B4 y
   B5.
3. En Railway:
   - `SHOPIFY_ADMIN_API_TOKEN` = el `shpat_` nuevo.
   - `SHOPIFY_WEBHOOK_SECRET` = el **client secret nuevo**.
4. El secret viejo **no** se revoca todavía (eso va en la fase D).

Efecto durante la transición: algunos webhooks de Shopify pueden fallar con
401 porque la firma no coincide (`shopify-hmac.guard.ts` acepta un solo
secreto). Shopify los reintenta, y el cron de órdenes (cada 10 minutos)
recupera los pedidos que falten. No hace falta tocar código.

### B4. Bases de datos (justo antes del deploy)

1. **Redis:** seguir la guía de Railway para rotar credenciales de Redis.
   Consiste en poner un `REDIS_PASSWORD` nuevo en el servicio **Redis** y
   redesplegar Redis. `REDIS_URL` del backend es una referencia
   (`${{Redis.REDIS_URL}}`) y se actualiza sola. Los datos persisten en el
   volumen.
2. **Postgres:** Railway → Postgres → **Credentials → Regenerate password**.
   La contraseña vieja deja de funcionar **en ese instante** y las conexiones
   nuevas del backend fallarán hasta el deploy, por eso es el último paso.
   `DATABASE_URL` del backend es una referencia (`${{Postgres.DATABASE_URL}}`)
   y se actualiza sola.

### B5. Un solo deploy

- Railway → `backend` → aplicar los cambios pendientes y **Deploy**. Si
  *Redeploy* no está disponible: *Ctrl/Cmd+K → Deploy Latest Commit*.
- El pre-deploy `npm run migrate:deploy` corre primero, ya con la contraseña
  nueva de Postgres. Si falla, el deploy se aborta y sigue viva la versión
  anterior, que ya no puede conectarse a la BD. Hay que revisar los logs en
  ese momento.

## 6. Fase C: verificación

1. `curl -s https://api.clawpuzzle.com/api/health` → 200.
2. Postgres sigue sin proxy (comprobación de A2).
3. En `www.clawpuzzle.com`:
   - Login con **Google**: confirma `GOOGLE_CLIENT_SECRET` y los JWT nuevos.
   - Login del **admin** con contraseña.
4. Una **generación** de principio a fin con el admin, que no gasta créditos:
   confirma `FAL_KEY` y Cloudinary.
5. Logs del backend (`railway logs --service backend`):
   - Sin errores de Prisma ni de Redis (BullMQ conecta).
   - Sin 401 en `/api/webhooks/shopify/*` después de los primeros minutos.
   - El sync de productos (cada 6 h) y el cron de órdenes (cada 10 min)
     corren sin errores de autenticación con el `shpat_` nuevo.
6. Shopify Dev Dashboard → ClawArt → Webhooks: las entregas recientes salen
   en 200.

## 7. Fase D: revocar lo viejo y cerrar

1. **Solo si la fase C pasó**, revocar las credenciales viejas:
   - [ ] Shopify: revocar el client secret viejo. Esto destruye cualquier
         token que siguiera atado a él.
   - [ ] fal.ai: borrar la clave vieja.
   - [ ] Cloudinary: desactivar y borrar la API key vieja.
   - [ ] Google Cloud: deshabilitar y borrar el secret viejo.
2. Si la fase A4 encontró algo (un admin desconocido, créditos o pedidos
   fantasma, gasto anómalo), se corrige caso por caso, siempre con visto
   bueno previo. Los créditos se revierten con los helpers del ledger.
3. Actualizar la memoria `railway-production`: proxy de Postgres apagado,
   fecha de rotación y que ya no existe `DATABASE_PUBLIC_URL`.
4. Opcional: añadir a `backend/docs/DEPLOY.md` una sección corta "Rotación de
   secretos" con la tabla de la fase B.
5. Opcional, como endurecimiento: marcar las variables secretas como
   **sealed** en Railway (no se pueden leer desde la UI, la API ni el CLI).
   No está claro si las sealed quedaron fuera del alcance del incidente, así
   que esto no sustituye a la rotación.

## 8. Estado (22-oct-2026)

- [x] A1: `railway login` renovado (`--browserless`, por WSL).
- [x] A2: TCP proxy de Postgres cerrado. La API no lista proxies en Postgres
      ni en Redis, y `nozomi.proxy.rlwy.net:17269` corta la conexión sin
      responder como Postgres.
- [x] Variables revisadas (solo nombres): coinciden con el inventario, no
      hay `ADMIN_PASSWORD` ni `PICTOREM_*`, y Redis no tiene URL pública.
- [x] GitHub revisado: sin hallazgos.
- [ ] A3: revisión de paneles (fal, Cloudinary, Shopify, Audit Logs de
      Railway, email).
- [ ] A4: forense en la BD, pendiente de `railway ssh keys add`.
- [ ] Fases B, C y D: esperando que Railway reactive los builds de Hobby
      (última comprobación: 14:50 UTC, todavía pendiente).
