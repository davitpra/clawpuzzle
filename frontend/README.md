# ClawPuzzle — Storefront

Frontend Next.js 16 (App Router) del ecommerce de rompecabezas personalizados.
El cliente sube la foto de su mascota, genera arte con IA y lo compra impreso
como puzzle. El catálogo y el checkout viven en Shopify.

Derivado de ClawAndSoul. Lo que cambió en el fork está en `CLAUDE.md`.

## Arranque

```bash
npm ci
cp .env.example .env.local   # y rellena los valores
npm run dev                  # http://localhost:3000
```

Necesita el backend corriendo en `NEXT_PUBLIC_API_URL` (por defecto
`http://localhost:3001/api`) para auth, estilos, generación y créditos. El
catálogo y el carrito funcionan solo con las credenciales de Shopify.

## Comandos

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm run start       # servir el build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Arquitectura, convenciones y qué cambió en el fork | `CLAUDE.md` |
| Reglas del panel admin (Polaris, no Tailwind) | `src/app/admin/ARCHITECTURE.md` |
| Tokens de diseño (Tailwind v4, sin config file) | `src/app/globals.css` |
| Sistema de diseño | `docs/DESIGN.md` |
| Tipo de producto (`Puzzle` \| `Credits`) | `src/entities/product/lib/template.ts` |
| Presentación del producto y retícula de piezas | `src/entities/product/lib/frameStyle.ts`, `src/entities/product/ui/PuzzlePieceOverlay.tsx` |
| Llamadas autenticadas al backend | `src/lib/auth/fetch-with-refresh.ts` |
| Cliente de Shopify (dual-mode) | `src/lib/shopify/` |

## Variables de entorno

Están documentadas una por una en `.env.example` y en la sección
"Environment Variables" de `CLAUDE.md`. Las `NEXT_PUBLIC_*` se inlinean en el
build: cambiarlas exige redeploy.
