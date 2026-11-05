# Runbook: migrar el backend de Railway a AWS Lightsail

Mueve `api.clawpuzzle.com` (API + Postgres + Redis) de Railway a un servidor
Lightsail con el `docker-compose.yml` de esta carpeta. El frontend sigue en
Vercel y Shopify, Cloudinary, fal y Google no cambian: como el dominio de la API
es el mismo, no hay que tocar webhooks, CORS, cookies ni OAuth.

Fases:

1. [Preparar el servidor](#1-preparar-el-servidor) — días antes, sin riesgo.
2. [Ensayo](#2-ensayo-con-una-copia-de-la-base) con una copia de la base y un
   dominio temporal.
3. [Corte](#3-corte) — ventana de mantenimiento de ~30 min.
4. [Después del corte](#4-después-del-corte): backups, limpieza de Railway.

Convenciones: `[local]` = tu máquina (WSL, en la raíz del repo); `[server]` =
el servidor Lightsail por SSH, en `~/clawpuzzle/deploy`.

---

## 1. Preparar el servidor

### 1.1 Cuenta de AWS

- Activar MFA en el usuario root y no volver a usarlo para el día a día.
- *Billing → Budgets*: presupuesto mensual de ~$30 con alerta por email.

### 1.2 Instancia

Lightsail → *Create instance*:

- Región **us-east-1 (Virginia)**.
- *Linux/Unix* → *OS Only* → **Ubuntu 24.04 LTS**.
- Plan de **2 GB de RAM** (~$12/mes). Con 1 GB el `npm ci` + `nest build` se
  queda sin memoria.
- Nombre: `clawpuzzle-api`.

Después, en la instancia:

- *Networking → Create static IP* y asociarla (gratis mientras esté asociada).
- *Networking → IPv4 Firewall*: dejar `SSH 22` y `HTTP 80`, añadir `HTTPS 443`
  (TCP) y `Custom UDP 443` (HTTP/3, opcional).
- *Snapshots → Automatic snapshots*: activarlos (backup diario del disco entero).
- Descargar la clave SSH por defecto (*Account → SSH keys*) a
  `~/.ssh/lightsail-clawpuzzle.pem` y `chmod 600`.

```bash
[local]  ssh -i ~/.ssh/lightsail-clawpuzzle.pem ubuntu@<IP_ESTATICA>
```

### 1.3 Docker, swap y repo

```bash
[server] curl -fsSL https://get.docker.com | sudo sh
[server] sudo usermod -aG docker ubuntu && exit   # volver a entrar para que aplique

# Swap de 2 GB: el build de la imagen pica por encima de la RAM.
[server] sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile \
         && sudo mkswap /swapfile && sudo swapon /swapfile \
         && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

El repo es privado: se clona con una **deploy key** de solo lectura.

```bash
[server] ssh-keygen -t ed25519 -N '' -f ~/.ssh/github_deploy -C clawpuzzle-lightsail
[server] cat ~/.ssh/github_deploy.pub
# GitHub → repo → Settings → Deploy keys → Add (sin "Allow write access")
[server] printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n' >> ~/.ssh/config
[server] git clone git@github.com:davitpra/clawpuzzle.git ~/clawpuzzle
```

> El commit con `deploy/` tiene que estar en GitHub antes de clonar.

Ubuntu trae `unattended-upgrades` activo: los parches de seguridad del sistema
se instalan solos.

---

## 2. Ensayo con una copia de la base

Objetivo: comprobar build, restore, migraciones y HTTPS **sin tocar
producción**. Se hace con un dominio temporal y con credenciales falsas de los
servicios externos.

> **No pongas el `SHOPIFY_ADMIN_API_TOKEN` real en el ensayo.** Al arrancar, la
> API hace `POST /webhooks.json` hacia `APP_PUBLIC_URL`: con el token real y
> otro dominio, Shopify empezaría a mandar los webhooks también al servidor de
> ensayo. Lo mismo con Cloudinary (borra assets) y fal (`MOCK_AI=true`).

### 2.1 DNS temporal

Namecheap → *Advanced DNS*: `A` · host `api-aws` · valor `<IP_ESTATICA>` · TTL
1 min.

### 2.2 Variables

```bash
[server] cd ~/clawpuzzle/deploy
[server] cp .env.example .env && cp .env.backend.example .env.backend
[server] chmod 600 .env .env.backend
[server] openssl rand -hex 32   # una vez por cada secreto
```

- `.env`: `POSTGRES_PASSWORD` y `REDIS_PASSWORD` nuevas (hex),
  `API_DOMAIN=api-aws.clawpuzzle.com`, `ACME_EMAIL=<tu email>`.
- `.env.backend`: los valores de ejemplo tal cual salvo `JWT_*_SECRET` (hex
  nuevos), `MOCK_AI=true`, `ACCOUNT_LIFECYCLE_ENABLED="false"`.

### 2.3 Copia de la base de Railway

Railway no tiene proxy TCP público para Postgres: el dump sale por `railway ssh`
en base64 (la salida binaria no sobrevive al canal tal cual).

```bash
[local]  cd backend && railway link   # proyecto Claw Puzzle, entorno production
[local]  railway ssh -i ~/.ssh/id_rsa --service Postgres -- \
           'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc | base64 -w0' \
         | base64 -d > ~/clawpuzzle-prod.dump
[local]  docker run --rm -v ~/clawpuzzle-prod.dump:/d.dump:ro postgres:18 \
           pg_restore -l /d.dump | head      # debe listar tablas, no dar error
[local]  scp -i ~/.ssh/lightsail-clawpuzzle.pem ~/clawpuzzle-prod.dump ubuntu@<IP_ESTATICA>:~/
```

> El dump contiene datos personales de clientes. Bórralo de tu máquina y del
> servidor al terminar el ensayo.

### 2.4 Restaurar y arrancar

```bash
[server] docker compose build                 # ~3-5 min la primera vez
[server] docker compose up -d postgres redis  # solo la base, todavía vacía
[server] docker compose exec -T postgres \
           pg_restore -U clawpuzzle -d clawpuzzle --no-owner --no-acl < ~/clawpuzzle-prod.dump
[server] docker compose up -d                 # migrate (no debería aplicar nada) → API → Caddy
[server] docker compose ps -a                 # migrate "Exited (0)", backend "healthy"
[server] docker compose logs migrate | tail -3
[server] docker compose logs -f caddy         # esperar "certificate obtained successfully"
```

Si `pg_restore` se queja de `schema "public" already exists`, es inofensivo.
Cualquier otro error, no.

### 2.5 Comprobar

```bash
[local]  curl -s https://api-aws.clawpuzzle.com/api/health
[local]  curl -s https://api-aws.clawpuzzle.com/api/styles | head -c 300
[local]  curl -s -o /dev/null -w '%{http_code}\n' http://api-aws.clawpuzzle.com/api/health   # 308
```

- Login de admin con password por `curl -X POST .../api/auth/login`.
- Conteos (sección [3.4](#34-verificar-los-datos)) iguales a los de Railway en
  el momento del dump.

Los errores 401 de Shopify en los logs son esperables (token falso).

### 2.6 Limpiar el ensayo

```bash
[server] docker compose down
[server] docker volume rm clawpuzzle_pgdata clawpuzzle_redisdata
[server] rm ~/clawpuzzle-prod.dump
[local]  rm ~/clawpuzzle-prod.dump
```

Namecheap: borrar el registro `api-aws`. Se deja `clawpuzzle_caddy_data`, no
estorba.

---

## 3. Corte

### 3.0 El día anterior

- Namecheap: bajar el **TTL del CNAME `api`** (el que apunta a Railway) a
  **1 min**, para que el cambio de DNS se propague rápido.
- Elegir una hora de poco tráfico y avisar si hace falta.

### 3.1 Variables reales

Volcar las variables actuales de Railway a un archivo (no a la pantalla):

```bash
[local]  cd backend
[local]  (umask 077; railway variables --service backend --environment production --kv > ~/railway-backend.env)
```

Construir `deploy/.env.backend` del servidor a partir de ese archivo:

- **Quitar**: `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `REDIS_*`, `PORT` y
  cualquier `RAILWAY_*`. Compose las construye él.
- **Mantener** los `JWT_*_SECRET` actuales: cambiarlos cierra la sesión de
  todos los usuarios. Si se quieren rotar, hacerlo otro día, aparte.
- Comprobar `NODE_ENV="production"`, `MOCK_AI=false`,
  `APP_PUBLIC_URL="https://api.clawpuzzle.com"`,
  `COOKIE_DOMAIN=".clawpuzzle.com"`, `FRONTEND_URL` con `www` y apex,
  `ACCOUNT_LIFECYCLE_ENABLED="true"`.

En `deploy/.env` del servidor: `API_DOMAIN=api.clawpuzzle.com` (las contraseñas
de Postgres y Redis pueden ser las del ensayo).

```bash
[local]  scp -i ~/.ssh/lightsail-clawpuzzle.pem ~/railway-backend.env ubuntu@<IP_ESTATICA>:~/
# editar en el servidor, copiar a ~/clawpuzzle/deploy/.env.backend (chmod 600)
[server] rm ~/railway-backend.env
[local]  rm ~/railway-backend.env
```

Con el código al día:

```bash
[server] cd ~/clawpuzzle && git pull && cd deploy && docker compose build
```

### 3.2 Parar Railway

1. Comprobar que no hay generaciones a medias (un job cortado se pierde):

   ```bash
   [local] railway ssh -i ~/.ssh/id_rsa --service Postgres -- \
     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select status, count(*) from generations group by status"'
   ```

   Si aparece `pending` o `processing`, esperar un par de minutos y repetir.
2. **Anotar la hora (UTC)**: hace falta en el paso 3.6.
3. Railway → servicio `backend` → *Deployments* → en el deployment activo,
   `⋯` → **Remove**. Postgres y Redis de Railway se quedan encendidos.
4. `curl https://api.clawpuzzle.com/api/health` ya no debe responder 200.

Desde aquí la API está caída. Shopify reintenta los webhooks que fallan durante
varias horas, y el paso 3.6 recupera lo que se escape.

### 3.3 Dump y restore definitivos

Igual que en 2.3 y 2.4, ahora con Railway parado:

```bash
[local]  railway ssh -i ~/.ssh/id_rsa --service Postgres -- \
           'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc | base64 -w0' \
         | base64 -d > ~/clawpuzzle-prod.dump
[local]  scp -i ~/.ssh/lightsail-clawpuzzle.pem ~/clawpuzzle-prod.dump ubuntu@<IP_ESTATICA>:~/

[server] docker compose up -d postgres redis
[server] docker compose exec -T postgres \
           pg_restore -U clawpuzzle -d clawpuzzle --no-owner --no-acl < ~/clawpuzzle-prod.dump
```

Redis **no** se migra: con las colas vacías no hay nada que conservar.

### 3.4 Verificar los datos

Ejecutar en los dos lados y comparar:

```sql
select 'users', count(*) from users
union all select 'orders', count(*) from orders
union all select 'order_items', count(*) from order_items
union all select 'generations', count(*) from generations
union all select 'credit_transactions', count(*) from credit_transactions
union all select 'print_projects', count(*) from print_projects
union all select 'migrations', count(*) from _prisma_migrations;
```

```bash
[server] docker compose exec -T postgres psql -U clawpuzzle -d clawpuzzle -c "<consulta>"
[local]  railway ssh -i ~/.ssh/id_rsa --service Postgres -- 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "<consulta>"'
```

### 3.5 Arrancar y cambiar el DNS

```bash
[server] docker compose up -d
[server] docker compose ps -a        # migrate Exited (0), backend healthy
```

Namecheap → *Advanced DNS*:

- Borrar el `CNAME api` → `*.up.railway.app` y el `TXT` de verificación de
  Railway.
- Añadir `A` · host `api` · valor `<IP_ESTATICA>` · TTL 1 min.

```bash
[local]  dig +short api.clawpuzzle.com @1.1.1.1    # debe dar la IP estática
[server] docker compose logs -f caddy              # "certificate obtained successfully"
```

Si Let's Encrypt valida antes de que el DNS se propague, el primer intento falla
y Caddy reintenta solo; esperar unos minutos.

### 3.6 Comprobar producción

- `curl https://api.clawpuzzle.com/api/health` → 200.
- En `https://www.clawpuzzle.com`: login con Google, ver mascotas y galería,
  lanzar una generación (consume 1 crédito; se puede usar el admin, que no
  consume).
- Admin: pedidos, Print Studio.
- Logs sin errores nuevos: `docker compose logs --since 15m backend | grep -i error`.
  Al arrancar, el registro de webhooks debe decir "already registered" (422),
  no "Failed".
- **Recuperar pedidos del corte**: desde el admin, o con un token de admin:

  ```bash
  curl -X POST https://api.clawpuzzle.com/api/admin/orders/sync \
    -H 'Authorization: Bearer <token admin>' -H 'Content-Type: application/json' \
    -d '{"since":"<hora del paso 3.2 en ISO, p. ej. 2026-11-12T03:00:00Z>"}'
  ```

- Borrar los dumps: `rm ~/clawpuzzle-prod.dump` en el servidor y en local.

### 3.7 Vuelta atrás

Solo si algo grave falla en la primera hora:

1. Namecheap: borrar el `A api` y volver a crear el `CNAME api` y el `TXT` de
   Railway (valores en Railway → backend → *Settings → Networking*).
2. Railway → *Deployments* → **Redeploy** del deployment retirado. Si el
   dashboard no lo ofrece, el `serviceInstanceDeployV2` con el commit actual.
3. `docker compose down` en el servidor.

Lo que se haya escrito en la base de AWS mientras tanto (pedidos, créditos) **no
vuelve solo** a Railway: cuanto antes se decida, menos hay que conciliar.

---

## 4. Después del corte

### 4.1 Backup diario de la base

Los snapshots de Lightsail copian el disco entero; además conviene un dump
lógico, que se restaura en cualquier sitio.

```bash
[server] mkdir -p ~/backups
[server] crontab -e
```

```cron
30 7 * * * cd /home/ubuntu/clawpuzzle/deploy && docker compose exec -T postgres pg_dump -U clawpuzzle -d clawpuzzle -Fc > /home/ubuntu/backups/clawpuzzle-$(date +\%F).dump && find /home/ubuntu/backups -name '*.dump' -mtime +14 -delete
```

(07:30 UTC = 02:30 en Ecuador, fuera de los crons de la app.)

Recomendado: subir cada dump a un bucket S3 privado con un usuario IAM que solo
pueda escribir en ese bucket, para tener una copia fuera del servidor.

### 4.2 Desplegar cambios

```bash
[server] cd ~/clawpuzzle && git pull && cd deploy && docker compose up -d --build
```

`migrate` corre antes de que arranque la API nueva; la API se corta unos
segundos mientras se reinicia. Automatizarlo desde GitHub Actions (SSH al
servidor) queda para más adelante.

### 4.3 Operación diaria

```bash
docker compose ps                      # estado
docker compose logs -f --tail 100 backend
docker compose restart backend
docker compose exec postgres psql -U clawpuzzle -d clawpuzzle
df -h /                                # disco
```

Monitor externo: dar de alta `https://api.clawpuzzle.com/api/health` en un
servicio de uptime gratuito (UptimeRobot, Better Stack) con aviso por email.

### 4.4 Cerrar Railway (tras una semana estable)

- Railway → borrar el dominio `api.clawpuzzle.com` del servicio `backend` y
  después los servicios `backend`, `Postgres` y `Redis` del proyecto
  `Claw Puzzle`. Sus variables son de la época del incidente.
- Volver a subir el TTL del `A api` en Namecheap (p. ej. 30 min).
- Actualizar `backend/docs/DEPLOY.md` y la sección *Deployment* de
  `backend/CLAUDE.md`, que siguen describiendo Railway.
