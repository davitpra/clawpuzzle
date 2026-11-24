# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server at http://localhost:3000

# Building & Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Architecture Overview

This is a Next.js 16.1.1 e-commerce frontend for ClawPuzzle: a pet photo is
turned into AI art and sold printed as a custom jigsaw puzzle, with Shopify
handling catalog and checkout. The codebase follows Feature-Sliced Design (FSD).

Derived from ClawAndSoul. What changed in the fork:

- **Two product types**: `Puzzle` and `Credits`. The `artKind` axis (pbn |
  print) is gone, and so are the Canvas / Poster / Digital / Accessory
  templates. The canonical table is `entities/product/lib/template.ts`.
- **The whole paint-by-numbers side is gone**: `lib/pbn`, `widgets/studio`,
  `features/pbn-studio`, `/studio`, `/user/pbn`, `/admin/pbn`.
- **`FrameStyle` is the leverage point**. `entities/product/lib/frameStyle.ts`
  maps a template to a presentation (`puzzle` | `art` | `credits`), today
  expressed through `FRAME_SHADOWS`. There is no piece-grid overlay: product
  photos already carry their own scene and are shown as-is.
  Change that component and the whole storefront changes with it.

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **State Management**: React Context API
- **Icons**: Lucide React, Material Symbols
- **Fonts**: Epilogue (headings), Lato (body)
- **Backend Integration**: Shopify Storefront API via GraphQL

## Shopify Integration

The app integrates with Shopify through a dual-mode GraphQL client:

### Client-Side Requests

- All client-side requests route through `/api/shopify/proxy` (src/app/api/shopify/proxy/route.ts)
- This prevents exposing Shopify credentials in the browser

### Server-Side Requests

- Direct GraphQL calls to Shopify Storefront API
- Requires `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (see
  [Environment Variables](#environment-variables))

### Shopify Module Structure

- **actions/**: Server-side data fetching functions (products, collections, cart, metaobjects)
- **queries/**: GraphQL query strings
- **client.ts**: Unified fetch function that handles both client/server contexts
- **types.ts**: TypeScript interfaces for Shopify entities

## State Management

### Authentication System

- **Security**: httpOnly cookies for JWT tokens (protected against XSS)
- **Token Lifetimes**:
  - Access Token: 15 minutes (stored in httpOnly cookie)
  - Refresh Token: 7 days (stored in httpOnly cookie)
- **Auto-Refresh**: Tokens automatically refresh at 13 minutes (2 min before expiry)
- **Context**: `AuthContext` manages auth state and user info
- **Protected Routes**: Use `useAuth()` hook to check authentication

#### Making Authenticated API Calls

```typescript
// Recommended: Use useAuthFetch hook (handles auto-refresh)
import { useAuthFetch } from '@/hooks/useAuthFetch';

const { get, post, put, delete } = useAuthFetch();
const data = await get('/users/profile');

// Alternative: Use fetchWithRefresh directly
import { fetchJSON } from '@/lib/auth/fetch-with-refresh';
const data = await fetchJSON('/api/endpoint');
```

### Cart System

- Global cart state managed via `CartContext` (src/context/CartContext.tsx)
- Persisted to `localStorage` with key `clawpuzzle_cart`
- Cart items include: variantId, name, size, style, color, price, quantity, img
- Access cart via `useCart()` hook from `src/hooks/useCart.ts`

### Cart Operations

```typescript
const {
  items,
  addToCart,
  updateQuantity,
  removeItem,
  clearCart,
  subtotal,
  cartCount,
} = useCart();
```

## Image Configuration

Remote image patterns configured in `next.config.ts`:

- `cdn.shopify.com/**` - Shopify product images

## Environment Variables

`.env.example` is the committed template (the only `.env*` file not gitignored);
copy it to `.env.local` and fill in real values.

| Variable | Public | Purpose / where it's read |
| --- | --- | --- |
| `SHOPIFY_STORE_DOMAIN` | no | Shopify store domain. `lib/shopify/client.ts`, `app/api/shopify/proxy/route.ts` |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | no | Storefront API token. Same two files. Never expose with a `NEXT_PUBLIC_` prefix |
| `NEXT_PUBLIC_SHOPIFY_STORE_SLUG` | yes | Store slug for deep links into admin.shopify.com. `entities/admin/lib/shopify-admin-url.ts` |
| `NEXT_PUBLIC_API_URL` | yes | NestJS backend base URL including `/api`. ~15 call sites (`hooks/useAuthFetch.ts`, `lib/auth/*`, `entities/*/api*`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | yes | Google OAuth web client ID; same value as the backend's `GOOGLE_CLIENT_ID`. `app/layout.tsx` |
| `NEXT_PUBLIC_LAUNCH_MODE` | yes | `"true"` enables launch mode (see below). `shared/config/launch.ts` |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical public origin for metadata, Open Graph, robots and sitemap. `shared/config/seo.ts` |
| `NEXT_PUBLIC_META_PIXEL_ID` | yes | Meta Pixel ID (ClawPuzzle). Empty = no Meta script. Production only on Vercel. `shared/config/analytics.ts` (see `../TRACKING.md`) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | yes | GA4 measurement ID (`G-…`). Empty = no Google script. Production only on Vercel. `shared/config/analytics.ts` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | yes | Cloudflare Turnstile site key for the guest session (free image without login). Empty = no captcha. `shared/config/guest.ts` |

`NEXT_PUBLIC_*` values are **inlined at build time**, so changing one requires a
rebuild — restart `npm run dev`, or redeploy on Vercel.

## Launch Mode

`NEXT_PUBLIC_LAUNCH_MODE=true` narrows the site to the launch funnel — landing →
AI art → puzzle offer — and hides the rest of the store. Nothing is deleted:
turning the flag off restores the full storefront.

Read the flag **only** through `src/shared/config/launch.ts`:

```typescript
import { LAUNCH_MODE } from "@/shared/config/launch";
```

What the flag changes:

- **`src/proxy.ts`** — two independent gates. The launch gate redirects anything
  outside `LAUNCH_ALLOWED_PREFIXES` to `/` (307; `/studio-landing` gets a 301
  because its content now lives at `/`), without looking at the session. The
  auth gate then applies to `/user/*` and `/admin/*` exactly as before. The
  `matcher` covers the whole site except `/api`, Next internals and any path
  with a file extension. **Adding a public route means adding it to that
  allow-list**, or it will redirect to `/`. `/login` is deliberately left out:
  unauthenticated `/user`/`/admin` visits go to `/`, and actions that need a
  session (navbar "Sign up", studio save, credit purchase) open the Google popup
  in place via `hooks/useGoogleSignIn.ts`.
- **`src/app/page.tsx`** — renders `StudioLandingPage` (from
  `widgets/studio-landing`) instead of `HomeHero`/`NewCollection`/…, and adopts
  its `studioLandingMetadata` via `generateMetadata`. The landing's section
  anchors are `#styles`, `#how-it-works` and `#faq`.
- **`src/shared/config/navigation.ts`** — resolves the flag itself and exports
  reduced `MAIN_NAV` / `FOOTER_SECTIONS`, so `Navbar` and `Footer` need no flag
  logic for their link lists. A `NavLink` with `cta: true` renders as a primary
  button.
- **`src/app/create/page.tsx`** — the flag picks the step order. Launch:
  `STEP_PHOTO → STEP_GENERATING`. Without a session, "Continuar" opens a
  **guest session** (`startGuestSession` in `AuthContext`, Turnstile if
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set) and generates the free image right
  away; `STEP_ACCOUNT` only appears when the backend refuses the guest session
  (switched off, daily cap, captcha). A guest saves its art by signing in with
  Google from `IAGeneratingStep` (same art, +4 credits on a new account). Coming from the launch
  product page (`product_ref_id` + `format_id`, no `style_id`) a style step comes
  first: `IAStyleStep` shows the landing's style cards (`LandingStylesView`) and
  picking one adds `style_id` to the URL. The product page itself no longer
  chooses a style (`ProductDetails` `styleSelectable`). Flag off: the classic
  `STEP_LEAD → STEP_UPLOAD → STEP_THANKS` driven by a product page. Both share the
  hooks in `widgets/ia-generator/model/`.
  **Bundle (2 or 3 puzzles, `qty` in the URL)**: `/create` hands over to
  `BundleFlow` — style and photo of puzzle 1, then of puzzle 2… (each generation
  starts as soon as its photo is sent and runs behind while the next one is set
  up; `BundleProgressStrip` shows it), then `BundleReviewStep` with one card
  per puzzle and a checkout of N lines of 1. The order lives in `localStorage`
  (`model/bundleOrder.ts`) and the step is derived from it, so a reload resumes.
  The landing asks for Google before entering with `qty` > 1; picking 2 or 3 on
  the single preview (`IAGeneratingStep`) turns that art into piece 1.
  **Auth flags**: `isAuthenticated` is **false for a guest** (so navbar,
  credits, pets list and `/user` treat it as a visitor); `hasSession` is true
  for both; `isGuest` tells them apart. `proxy.ts` sends a guest token on
  `/user` back to `/`.
  **Rule for the photo step: no authenticated call while `hasSession` is
  false.** A 401 there ends in the `window.location.href = "/login"` of
  `lib/auth/fetch-with-refresh.ts`, which throws the visitor out of the funnel and
  loses the photo they just uploaded. `usePetsList` and `useCredits` gate
  themselves; anything new must do the same.
- **UI hidden behind `!LAUNCH_MODE`** — the navbar cart icon and search box
  (both only lead to `/cart` / `/catalog`), the footer's `/catalog` link, the
  `/catalog` CTAs in the `/user` empty states, the purchase carousels in
  `GenerationDetail` / `PbnDetail`, and the checkout block of `IAThanksStep`
  (its "View Cart" targets `/cart`). `IAStartFromProduct` also swaps its default
  CTA from `/catalog` to `/#styles`.
- **`/credits`** — `CreditPackCard` checks out straight to Shopify with a single
  explicit line (`startCheckout([item])`) instead of going through `/cart`.

## Path Aliases

TypeScript path alias configured: `@/*` maps to `./src/*`

## Design System

- Custom Tailwind configuration with brand colors
- Font variables: `--font-epilogue` (headings), `--font-lato` (body)
- Material Symbols Outlined icon font loaded globally
- Light/dark mode support via Tailwind CSS classes
- For more details read `./docs/DESIGN.md`

## Admin Panel

The `/admin` route group follows its own conventions (Shopify Polaris instead of Tailwind, co-located components per route). Before creating or modifying anything under `src/app/admin/`, read `./src/app/admin/ARCHITECTURE.md`.
