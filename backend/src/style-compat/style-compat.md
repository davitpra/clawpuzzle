# Style-Compat Module

Read-only query layer that exposes, for a given style, which formats and products
are available with it — plus the ready-to-use product/format pair that the
style-first creation flow (`/create?style_id=…`) needs in order to generate
without a product page.

There is **no `StyleFormatProductCompat` table**. Compatibility is derived by
traversing `Style 1—N ProductReference 1—N ProductFormatVariant N—1 Format`: a
format is compatible with a style when some active product of that style has an
active variant for it.

## Files Structure

- `style-compat/style-compat.service.ts`: Query logic to resolve compatible formats and products for a style.
- `style-compat/style-compat.controller.ts`: Public endpoint mounted under `/api/styles`.
- `style-compat/style-compat.module.ts`: Module definition.

## Endpoints

| Method | Endpoint                      | Auth Required | Description                                      |
| :----- | :---------------------------- | :------------ | :----------------------------------------------- |
| `GET`  | `/api/styles/:styleId/compat` | No            | Get compatible formats and products for a style. |

## Response Shape

```json
{
  "styleId": "uuid",
  "formats": [ "...Format" ],
  "productReferences": [ "...ProductReference" ],
  "defaultCreateContext": { "productRefId": "uuid", "formatId": "uuid" }
}
```

- **`formats`**: Deduplicated list of all active formats reachable from this style.
- **`productReferences`**: Active product references that carry this style (without their variants).
- **`defaultCreateContext`**: The `(productRefId, formatId)` pair to send to
  `POST /generations`, resolved as the style's first active `template: 'Digital'`
  product with at least one active variant. **`null`** when the style has no such
  product — the frontend treats that as "this style is not connected to an
  available digital product yet" and sends the user back to the style gallery.

## How It Works

1. Validates the style exists **and is active**; throws `404` if not.
2. Queries active `ProductReference`s for the style, including active
   `productVariants` whose `format` is also active.
3. Deduplicates formats in memory, ordering products by `displayName` then `id`
   and variants by `id` so the default pair is stable across requests.
4. Picks `defaultCreateContext` from the first Digital product with variants.

## Where compatibility is actually enforced

This module is **advisory** — it is what the UI reads to build its links. The
authoritative check is on the write path: `GenerationsService.createImageGeneration`
re-validates the pair with
`productFormatVariant.findFirst({ productRefId, formatId, isActive: true })` and
returns `400 "The requested format is not available for this product."` if it is
missing. The style itself is never sent by the client — it is derived from
`ProductReference.styleId`.

## Features

- **Read-Only**: No write operations. Products, variants and formats are managed elsewhere.
- **Public**: Uses `@Public()` — no authentication required.
- **Deduplication**: A format reachable through several products appears once.
