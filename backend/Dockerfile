# syntax=docker/dockerfile:1
#
# Imagen del backend para el despliegue con Docker Compose (deploy/).
#
# Targets:
#   runtime (default) -> la API: solo dependencias de producción y dist/.
#   migrate           -> corre `prisma migrate deploy` y termina. Necesita el
#                        CLI de prisma y dotenv, que son devDependencies, así que
#                        sale de la etapa de build y no de runtime.
#
# Debian slim y no Alpine: bcrypt y sharp traen binarios precompilados para
# glibc; en musl bcrypt acaba compilándose desde el código fuente.

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# El postinstall corre `prisma generate`, que no necesita DATABASE_URL.
RUN npm ci
COPY . .
RUN npm run build

FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM build AS prune
# Conserva node_modules/.prisma/client, el cliente generado en el build.
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3001
COPY --chown=node:node package.json ./
COPY --from=prune --chown=node:node /app/node_modules ./node_modules
COPY --from=prune --chown=node:node /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
