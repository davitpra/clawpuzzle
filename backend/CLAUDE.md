# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawPuzzle Backend is a NestJS API for an ecommerce that turns a pet photo into
AI-generated art and sells it printed as a custom jigsaw puzzle.

It is derived from ClawAndSoul (same generation engine, different physical
product). What changed in the fork:

- **Catalog**: two product types — `Puzzle` and `Credits`. The old five-value
  `template` axis and the parallel `artKind` (pbn | print) axis are gone.
- **Paint-by-numbers is gone** entirely: model, module, studio and artifacts.
- **Production is in-house**: no POD provider, no Pictorem. The admin prints,
  die-cuts and ships; `productionStatus` drives that queue and gained a
  `packed` step between `printed` and `shipped`.
- **Variants are piece counts** (300 / 500 / 1000), modelled as `Format` rows
  with `pieceCount` plus the assembled size in `printWidthCm`/`printHeightCm`.
  Careful: `Format.width`/`height` are *generation pixels*, not the physical
  size — they always were, but nothing depended on it until now.

Unchanged from ClawAndSoul: auth, credits, pets, styles, the fal.ai +
OpenRouter generation pipeline, the Shopify sync and the order ingestion.

## Development Commands

```bash
# Install dependencies
npm install

# Development
npm run start:dev          # Start with hot-reload
npm run start:debug        # Start with debugger

# Build
npm run build              # Compile TypeScript
npm run start:prod         # Run production build

# Code Quality
npm run lint               # Run ESLint with auto-fix
npm run format             # Format with Prettier

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run with coverage
npm run test:e2e           # Run e2e tests
npm run test:debug         # Run with Node debugger
```

## Database & Prisma

The project uses Prisma ORM with PostgreSQL. Database: `clawandsoul_dev`

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name <migration-name>

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (warning: deletes all data)
npx prisma migrate reset
```

**Important**: Always run `npx prisma generate` after pulling schema changes or the Prisma client will be out of sync.

## Architecture

### Module Structure

The application follows NestJS modular architecture with domain-driven modules:

- **auth**: JWT-based authentication with refresh tokens, passport strategies
- **users**: User management and profile operations
- **pets**: Pet profiles and photo management
- **styles**: AI art style catalog (categories, prompt templates)
- **generations**: Core AI generation engine (images/videos), status tracking, provider abstraction
- **storage**: Cloudinary file upload/retrieval service (global module)
- **prisma**: Database service (global module)
- **orders**: Shopify order ingestion, production status machine, print masters
- **products** / **formats**: local catalog mirrored from Shopify; `Format` is
  the piece-count axis of a puzzle
- **credits**: idempotent credit ledger
- **shopify-sync**: Admin API client, HMAC guard, queued product sync

### Global Configuration

Configuration is centralized in `src/config/`:
- `database.config.ts` - Database connection settings
- `jwt.config.ts` - JWT secret and expiration
- `redis.config.ts` - Redis/caching configuration

All configs loaded globally via `ConfigModule.forRoot()` in `app.module.ts`.

### Authentication & Authorization

- **Global JWT Guard**: All endpoints require authentication by default (`JwtAuthGuard` registered as `APP_GUARD`)
- **@Public() Decorator**: Use on controllers/routes to bypass authentication (e.g., login, register)
- **@Roles() Decorator**: Restrict endpoints to specific user roles (user, premium, admin)
- **@CurrentUser() Decorator**: Inject authenticated user into route handlers

Example:
```typescript
@Public()  // No auth required
@Post('login')
async login() { ... }

@Roles('admin')  // Admin only
@Delete('users/:id')
async deleteUser() { ... }

@Post('generate')
async generate(@CurrentUser() user: User) { ... }
```

### Request/Response Pipeline

1. **Logging Interceptor**: Logs all requests/responses
2. **Transform Interceptor**: Standardizes API response format
3. **Validation Pipe**: Validates DTOs (whitelist, transform enabled)
4. **HTTP Exception Filter**: Formats error responses consistently

### Key Patterns

**Prisma Service**: Injected globally. Access via constructor:
```typescript
constructor(private prisma: PrismaService) {}
```

**DTOs**: Use class-validator decorators. All DTOs auto-validated before reaching controllers.

**Database Relations**: The schema uses cascade deletes extensively:
- Deleting a User cascades to pets, generations, etc.
- Deleting a Pet cascades to photos and generations
- Use `onDelete: SetNull` for optional relations (e.g., generations can exist without petPhoto)

## API Documentation

Swagger UI available at: `http://localhost:3001/api/docs`

All endpoints prefixed with `/api` (configured in `main.ts`).

## Database Schema Highlights

**Core Entities**:
- **User**: credentials, role (user/premium/admin), `generationCredits`
- **Pet** / **PetPhoto**: user-owned pet profiles and their photos
- **Style**: AI art styles with their prompt template and vision/imagegen config
- **Generation**: AI generation jobs with status tracking
- **ProductReference**: a Shopify product mirrored locally; `template` is
  `Puzzle` or `Credits`
- **Format**: the piece-count axis. `pieceCount` + `printWidthCm`/`printHeightCm`
  (physical, centimetres) + `width`/`height` (generation pixels — *not* the
  physical size)
- **ProductFormatVariant**: ProductReference × Format × Shopify variant, with
  `constraints` (cropMode, maxPets, bleedMm) and `printConfig`
- **Order** / **OrderItem** / **OrderEvent**: ingested from Shopify webhooks

**Enums** (stored as strings, no native Prisma enums):
- User role: `user`, `premium`, `admin`
- Pet species: `dog`, `cat`, `bird`, `rabbit`, `other`
- Generation status: `pending`, `processing`, `completed`, `failed`
- `ProductReference.template`: `Puzzle`, `Credits`
- `OrderItem.productionStatus`: `pending`, `generating`, `art_failed`, `draft`,
  `pre_production`, `in_production`, `printed`, `packed`, `shipped`,
  `delivered`, `on_hold`, `cancelled`, `refunded`, `restocked`.
  Vocabulary and transitions live in `src/orders/production-status.util.ts`;
  the frontend mirrors them in `entities/admin/lib/` — **edit both together or
  the admin offers transitions the backend rejects**.

## Generation Credit Model

Image generations consume **generation credits** (1 per generation). See the
`credits` module (`src/credits/`):

- Each user starts with **5 free credits** (signup bonus, granted via the ledger).
- A **paid Shopify order grants +3 credits per unit** purchased on regular lines
  (reason `order_bonus`), and **credit-pack lines grant their mapped amount**
  (reason `pack_purchase`) — see the shared `grantOrderCredits` helper in
  `OrdersService`. Both are idempotent per order. **Digital/PBN lines are
  excluded** from the bonus (free product; granting would allow farming credits
  at $0) — same exclusion applies on reversal.
- **Admins are exempt** (role `admin` never consumes credits).
- Credit is **deducted atomically** when a generation is created (inside the same
  transaction) and **refunded automatically** if the generation ends in `failed`.
- A **refunded/cancelled order claws back** its granted credits per line, mirroring
  the grant (`5/unit` regular → `order_bonus_reversal`, pack line → `pack_purchase_reversal`),
  via the shared `reverseCreditsForItems` helper. It fires on the refund/cancel
  webhook (`refunds[]` payload for partials), the admin cancel endpoint, and manual
  item transitions to `cancelled`/`refunded`/`restocked`; it's idempotent per
  `(reason, OrderItem.id)`. Reversals **may drive the balance below 0** if the bonus
  was already spent — the spend guard (`gte: 1`) blocks generating while negative.
- Out of credits → `POST /api/generations` returns **402 Payment Required**.
- Admins can grant credits manually via `POST /api/admin/credits/grant`.

**Credit packs**: a `ProductReference` flagged `isCreditPack` sells credits as a
Shopify product; each Shopify variant maps to a credit amount via the
`CreditPackVariant` table (admin: `PATCH /admin/products/credit-pack` +
`PUT /admin/products/:id/credit-pack-variants`; storefront discovery:
`GET /products/credit-pack`). The authenticated checkout attaches a `_user_id`
line-item property so the webhook credits the right account (validated against
the order email). Pack `OrderItem`s start at `productionStatus: 'delivered'` so
they don't enter the production queue.

Balances live on `User.generationCredits`; every movement is recorded in the
`CreditTransaction` ledger, whose unique `(reason, referenceId)` enforces
idempotency (one signup bonus per user, one bonus + one pack grant per order, one
spend/refund per generation). The role system (user/premium/admin) still
differentiates admin exemption.

## Configuration

Environment variables are loaded from `.env.local` (priority) or `.env`.

**CORS**: Allowed origins come from `process.env.FRONTEND_URL` (default:
`http://localhost:3000`), which accepts a comma-separated list. Origins are
matched exactly, so `clawandsoul.com` and `www.clawandsoul.com` must both be
listed if both are served. Only hosts under `COOKIE_DOMAIN`'s root domain can
hold a session: the cookie is `sameSite=lax` and the browser drops it
cross-site. See `docs/DEPLOY.md`.

**Port**: Defaults to 3001 if `PORT` env var not set

## Deployment

Target: Railway (single always-on instance). See `docs/DEPLOY.md` for the full
procedure. Key constraints:

- **Never serverless**: BullMQ workers and four `@Cron` jobs live in the API
  process.
- **Never more than one replica**: the crons would run duplicated.
- Migrations run as Railway's pre-deploy command (`npm run migrate:deploy`),
  before the new code starts.
- Cookies rely on `COOKIE_DOMAIN` (`.clawandsoul.com`) so the API subdomain and
  the frontend share the session. `COOKIE_SAMESITE=none` is only needed if they
  ever end up on different root domains.
- Swagger (`/api/docs`) is off in production unless `SWAGGER_ENABLED=true`.

## MCP Servers

This project is configured with Model Context Protocol (MCP) servers to enhance Claude Code capabilities. See `MCP_SETUP.md` for detailed documentation.

### Configured Servers

1. **PostgreSQL MCP** - Direct database querying and schema inspection
2. **Context7 MCP** - Up-to-date documentation for NestJS, Prisma, etc.
3. **Redis MCP** - Cache inspection and session debugging
4. **Shopify MCP** - Product and order management integration

**Note**: For GitHub integration, use native `git` and `gh` CLI tools instead of an MCP server.

### Quick Start

1. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

2. Restart Claude Code to load MCP servers

3. Authenticate remote services:
   ```
   > /mcp
   ```

4. Use MCP capabilities in prompts:
   ```
   > "Show me all users in the database"
   > "Create a GitHub issue for this bug"
   > "Use context7 to show NestJS authentication docs"
   ```

### Managing MCP Servers

```bash
# List all MCP servers
> /mcp

# Or via CLI
claude mcp list
```

Configuration file: `.mcp.json` (shared with team via git)
