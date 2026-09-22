# Generations Module

Core engine for AI-powered image generation. Every generation **consumes 1
generation credit** (admins are exempt) — see `src/credits/` and the "Credits"
section below.

## Files Structure

```
generations/
├── generations.controller.ts                        # REST API endpoints (authenticated user)
├── admin-generations.controller.ts                  # GET /admin/strategies — lists registered strategy keys
├── generations.service.ts                           # Orchestration logic
├── generation-select.ts                             # Prisma `select` whitelists for user-facing responses
├── generations.module.ts                            # DI registration
├── constants/
│   └── queues.constants.ts                          # QUEUE_NAMES, JOB_NAMES
├── dto/
│   ├── create-image-generation.dto.ts
│   └── update-generation-flags.dto.ts
├── processors/
│   └── image-generation.processor.ts                # BullMQ worker — runs the pipeline
├── pipeline/
│   ├── pipeline.types.ts                            # PipelineContext, PipelineResult, BaseStyleStrategy
│   ├── strategy.registry.ts                         # Resolves style.strategyKey → strategy instance
│   └── strategies/
│       ├── style-driven-prompt.strategy.ts          # Default — prompt from the style template
│       ├── style-driven-prompt-multi.strategy.ts    # Same, with every pet photo as reference
│       ├── style-transfer-roles.strategy.ts         # Style reference image + subject photo
│       └── style-transfer-roles-multi.strategy.ts   # Style reference + every pet photo
└── providers/
    ├── openrouter/
    │   └── openrouter-prompt.service.ts             # Analyzes pet photo + builds creative prompt via openrouter/router/vision
    └── fal/
        └── fal.service.ts                           # Calls Fal.ai image model and downloads image buffer
```

**Response shape**: user-facing endpoints project through the whitelists in
`generation-select.ts`. Prompt engineering (`prompt`, `finalPrompt`,
`promptSnapshot`, `visionAnalysis`, `provider`, `metadata`, `falRequestId`…) is
business IP and is only exposed under `@Roles('admin')`.

---

## Image Generation Flow

### 1. HTTP Request

The user calls `POST /api/generations` with `petId`, `petPhotoId`, `formatId`,
`productRefId` and optional `userSelections`.

**`styleId` is not an input**: it is derived from the product
(`ProductReference.styleId`). A product with no style assigned yields a `400`.

`GenerationsService.createImageGeneration()`, in order:

1. **Pet ownership** — `petsService.findOne(petId)` + `pet.userId !== userId` →
   `400`. The pet must have at least one photo.
2. **Photo** — `petPhotoId` must exist, belong to that pet and have a `photoUrl`.
3. **Product** — `productRefId` must exist and be active (`404` otherwise), and
   must have a `styleId` (`400` otherwise). `styleId` is read from it.
4. **`userSelections`** — validated against the style's `templateVarOptions`
   (see "User selections" below). `400` on a missing required key or an
   out-of-catalog value.
5. **Format availability** — `productFormatVariant.findFirst({ productRefId,
   formatId, isActive: true })` → `400` if the format is not available for that
   product. The variant's `constraints` JSON is the source of generation rules.
6. **Role** — read fresh from the DB (not from the JWT, which can be stale after
   a role change): `admin` generates without spending credits.
7. **Transaction** — creates the `Generation` (`status: "pending"`, snapshotting
   `constraints` and `userSelections` into `metadata`) and spends 1 credit in the
   same `$transaction`. No balance → `CreditsService.spendForGeneration` throws
   **402 Payment Required** and the row is rolled back.
8. Enqueues `{ generationId }` in the BullMQ `image-generation` queue.

### 2. BullMQ Worker

`ImageGenerationProcessor.process()` picks up the job from Redis and runs:

```
findForProcessing(generationId)
  → loads Generation with relations: style (+ visionConfig, imageGenConfig), pet (+ photos), petPhoto, format
updateGenerationStatus("processing")
  → DB: status = "processing"
build constraints
  → { maxPets: 1, ...metadata.compatConstraints }
build subjectPhotoUrls
  → [petPhoto.photoUrl, ...rest of the pet's photos]
StrategyRegistry.get(style.strategyKey)
  → resolves the strategy; unknown key falls back to "style-driven-prompt" with a warning
strategy.execute(PipelineContext)
  → runs the 3-step pipeline (see below)
markCompleted(generationId, result)
  → DB: status = "completed", resultUrl, finalPrompt, visionAnalysis, falRequestId,
        processingTimeSeconds, promptSnapshot
```

On error: `markFailed(generationId, errorMessage)` → `status = "failed"`,
**refunds the credit** (best-effort and idempotent) and syncs any linked
`OrderItem`. BullMQ rethrows and can retry.

**Admin test generations** (`isAdminTest`) take their pet context and photo from
`metadata` instead of the relations, and on success the result is appended to the
style's `StyleImage` gallery.

### 3. The Pipeline

Each strategy receives a `PipelineContext` (`pipeline/pipeline.types.ts`):

```typescript
{
  generationId: string;
  petPhotoUrl: string;             // from PetPhoto.photoUrl (or metadata.inputPhotoUrl on admin tests)
  subjectPhotoUrls?: string[];     // every photo of the pet, the chosen one first
  style: Style & { visionConfig, imageGenConfig };
  pet: Pet;                        // name, species, breed
  format: Format | null;           // from generation.formatId
  constraints: { maxPets?: number; aspectRatio?: string; [k: string]: unknown };
  userSelections?: Record<string, string | number>;
}
```

**Known constraint keys**:

| Key           | Default | Description |
| :------------ | :------ | :---------- |
| `maxPets`     | `1`     | Max number of pets to describe in the vision prompt. Passed as a template var. |
| `aspectRatio` | —       | When present, overrides `format.aspectRatio` in the fal payload. Final fallback: `DEFAULT_ASPECT_RATIO = "3:4"`. |

#### Strategies

| `strategyKey`                 | Vision input            | Fal `image_urls`                        | Requires |
| :---------------------------- | :---------------------- | :-------------------------------------- | :------- |
| `style-driven-prompt`         | the chosen photo        | `[petPhoto]`                            | `visionConfig` + `imageGenConfig` |
| `style-driven-prompt-multi`   | all photos (max 4)      | all photos (max 4)                      | idem |
| `style-transfer-roles`        | the chosen photo        | `[styleReference, petPhoto]`            | idem + `style.styleReferenceUrl` |
| `style-transfer-roles-multi`  | all photos (max 4)      | `[styleReference, ...photos]`           | idem + `style.styleReferenceUrl` |

In the `-roles` variants image 1 is the style/pose reference and the rest carry
the subject's identity. A missing `visionConfig`, `imageGenConfig` or
`styleReferenceUrl` throws at execution time and the generation ends `failed`
(credit refunded).

With `MOCK_AI=true` every strategy short-circuits: no OpenRouter, no Fal.ai, no
Cloudinary upload — it returns the input photo as the result after ~500 ms. The
credit *is* still spent.

#### Step 1 — Vision + Prompt Generation (`OpenRouterPromptService`)

Calls `fal.subscribe("openrouter/router/vision", ...)` with the photo(s) and the
composed prompt. Template vars are merged in this order — later wins:

```ts
{
  ...style.templateVars,     // server-side defaults
  ...ctx.userSelections,     // validated user choices
  maxPets: ctx.constraints.maxPets,
  // and, inside the service: petName, petSpecies, petBreed (runtime context always wins)
}
```

`style.promptTemplate` is the whole message: `{{key}}` placeholders are replaced
with those vars and **unknown keys are left as-is**. The system prompt comes from
`visionConfig.systemPrompt` (or a default), plus `visionModel`,
`visionTemperature` (default `0.7`) and `maxTokens`.

The VLM's output is the final prompt. Saved to `Generation.finalPrompt`; the raw
`{ output, model, usage }` goes to `Generation.visionAnalysis` for cost auditing.

#### Step 2 — Image Generation (`FalService`)

```ts
const aspectRatio =
  ctx.constraints.aspectRatio ?? ctx.format?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
```

Calls `fal.subscribe(imageGenConfig.model, { input: { prompt, image_urls,
aspect_ratio, ...imageGenConfig.parameters } })` and waits synchronously, then
downloads the image as a `Buffer`.

`FalService.generate()` input fields:

| Field          | Maps to fal key  | Description |
| :------------- | :--------------- | :---------- |
| `model`        | —                | Model ID from `imageGenConfig.model` (fallback `"fal-ai/flux/dev"`). |
| `imageUrls`    | `image_urls`     | Source images for image-to-image models. Omitted when empty. |
| `aspectRatio`  | `aspect_ratio`   | Output aspect ratio string (e.g. `"4:5"`, `"16:9"`). |
| `numImages`    | `num_images`     | Number of images to generate. |
| `outputFormat` | `output_format`  | `"jpeg"` or `"png"`. |
| `params`       | spread last      | `imageGenConfig.parameters` — overrides all above on key collision. |

#### Step 3 — Upload to Cloudinary (`StorageService`)

Uploads the buffer to `generations/{generationId}/result`. The public URL is
saved to `Generation.resultUrl` and the key to `resultStorageKey`.

### 4. Full Status Lifecycle

```
pending → processing → completed
                    ↘ failed (credit refunded)
```

| Status       | When                                        |
| :----------- | :------------------------------------------ |
| `pending`    | Generation record created, credit spent, job enqueued |
| `processing` | Worker picked up the job, pipeline started  |
| `completed`  | All 3 steps succeeded, image URL saved      |
| `failed`     | Any step threw, errorMessage saved, credit refunded |

Poll status via `GET /api/generations/:id/status`.

---

## Credits

- 1 credit per generation, spent inside the creation transaction.
- `role === 'admin'` is exempt (role read from the DB, not the JWT).
- A `failed` generation refunds automatically — idempotent, so a retry that fails
  again does not refund twice, and an admin generation refunds nothing.
- No balance → `POST /api/generations` returns **402 Payment Required**. The
  frontend treats that 402 as the source of truth for "out of credits".

Full model (signup bonus, order grants, packs, reversals) in the root
`CLAUDE.md` and `src/credits/`.

---

## Adding a New Style Strategy

1. Create `pipeline/strategies/my-style.strategy.ts` extending `BaseStyleStrategy`:

   ```typescript
   @Injectable()
   export class MyStyleStrategy extends BaseStyleStrategy {
     readonly key = 'my-style';
     async execute(ctx: PipelineContext): Promise<PipelineResult> { ... }
   }
   ```

2. Register it in `GenerationsModule` providers.

3. Inject it into `StrategyRegistry` constructor and call `this.register(myStyleStrategy)`.

4. Set `strategyKey = "my-style"` on the `Style` record in DB.

`GET /api/admin/strategies` lists the registered keys (admin only).

---

## Constraints & User Selections

### Constraints — per product+format

There is **no compatibility matrix table**. A generation is valid when the
requested `formatId` has an active `ProductFormatVariant` for the requested
`productRefId`; the style comes from the product. That variant's `constraints`
(JSON) are:

1. **Snapshotted** into `Generation.metadata.compatConstraints` at creation time
   (audit/reproducibility).
2. **Loaded by the processor** with system defaults applied (`maxPets: 1`).
3. **Passed to the strategy** as `ctx.constraints` — a flat dict ready to use.

To add a new rule: add the key to the variant's `constraints` JSON and handle it
in the strategy. No code change for data-driven rules.

### User selections — per style

`Style.templateVarOptions` declares what the *user* may choose (e.g. background
color, number of colors). `validateUserSelections()` walks that definition —
never the client payload — so unknown keys are dropped, `required` keys missing
throw `400`, absent optional keys fall back to `default`, and `select` values
must exist in the option's catalog.

The result is stored in `Generation.metadata.userSelections` and merged into the
template vars at prompt time, on top of `style.templateVars`.

> Option keys are **not standardized across styles**: branch on the shape of the
> data, not on the key name.

---

## Style DB Fields for Pipeline Config

| Field                | Type    | Description                                                                          |
| :------------------- | :------ | :----------------------------------------------------------------------------------- |
| `strategyKey`        | string  | Registered strategy (default: `"style-driven-prompt"`)                               |
| `promptTemplate`     | text    | The full message sent to the VLM, with `{{placeholders}}`                            |
| `templateVars`       | Json?   | Server-side substitutions (e.g. `{ colorCount: 5 }`)                                 |
| `templateVarOptions` | Json?   | Which vars the user may choose, and their catalog/defaults                           |
| `styleReferenceUrl`  | string? | Style/pose reference image — required by the `style-transfer-roles*` strategies      |
| `visionConfigId`     | string? | → `VisionConfig`: `visionModel`, `visionTemperature`, `systemPrompt`, `maxTokens`    |
| `imageGenConfigId`   | string? | → `ImageGenConfig`: `model`, `parameters`                                            |

`VisionConfig` and `ImageGenConfig` are **shared, reusable rows**, not per-style
columns: several styles point at the same config, and `onDelete: SetNull` means
deleting one leaves the style without it — which makes its generations fail until
it is reassigned.

---

## Generation DB Fields

| Field            | Type    | Description                                                                   |
| :--------------- | :------ | :---------------------------------------------------------------------------- |
| `visionAnalysis` | Json?   | Raw VLM response `{ output, model, usage }` — used for cost auditing          |
| `finalPrompt`    | string? | Creative prompt produced by the VLM and sent to the image model               |
| `falRequestId`   | string? | Fal.ai vision request ID for traceability                                     |
| `promptSnapshot` | Json?   | Frozen copy of the config used — audit/reproducibility                        |
| `metadata`       | Json?   | `{ width, height, compatConstraints, userSelections }`                        |

### `promptSnapshot` structure

```json
{
  "visionConfigId": "…",
  "imageGenConfigId": "…",
  "promptTemplate": "...",
  "templateVars": { "colorCount": 5, "maxPets": 1 },
  "userSelections": { "background": "blue" },
  "visionModel": null,
  "visionTemperature": null,
  "visionSystemPrompt": null,
  "visionMaxTokens": null,
  "falModel": "fal-ai/nano-banana-2/edit",
  "constraints": { "aspectRatio": "4:5", "maxPets": 1 }
}
```

---

## Endpoints

All endpoints require JWT authentication.

| Method   | Endpoint                      | Query Params                                  | Description                                            |
| :------- | :---------------------------- | :-------------------------------------------- | :----------------------------------------------------- |
| `POST`   | `/api/generations`            | —                                             | Create an image generation job. `402` if out of credits. |
| `GET`    | `/api/generations`            | `?page&limit&status=pending\|...&pet_id=uuid` | List the authenticated user's generations (paginated). |
| `GET`    | `/api/generations/:id`        | —                                             | Get details of a specific generation.                  |
| `GET`    | `/api/generations/:id/status` | —                                             | Lightweight polling — returns `{ status, progress? }`. |
| `PATCH`  | `/api/generations/:id`        | —                                             | Update `isPublic` / `isFavorite` flags.                |
| `DELETE` | `/api/generations/:id`        | —                                             | Hard delete a generation.                              |
| `GET`    | `/api/admin/strategies`       | —                                             | Registered strategy keys. `@Roles('admin')`.           |

## DTOs

### POST `/api/generations` — CreateImageGenerationDto

| Field            | Type   | Required | Description                                                          |
| :--------------- | :----- | :------- | :------------------------------------------------------------------- |
| `petId`          | UUID   | **Yes**  | Pet to generate art for (must belong to user).                       |
| `petPhotoId`     | UUID   | **Yes**  | Source photo — must belong to that pet.                              |
| `formatId`       | UUID   | **Yes**  | Format — must have an active variant for this product.               |
| `productRefId`   | UUID   | **Yes**  | Product reference — supplies the style.                              |
| `userSelections` | object | No       | User-chosen values for the style's `templateVarOptions`.             |
| `prompt`         | string | No       | Stored on the generation; the pipeline uses `style.promptTemplate`.  |
| `negativePrompt` | string | No       | Stored on the generation.                                            |
| `provider`       | string | No       | `"openai"` \| `"stability"` — informational, defaults to `"openai"`. |
| `width`          | int    | No       | 512–2048, stored in metadata (default 1024).                         |
| `height`         | int    | No       | 512–2048, stored in metadata (default 1024).                         |

> `styleId` is **not** accepted — it is derived from `productRefId`. The
> ValidationPipe whitelist silently drops it if sent.

### PATCH `/api/generations/:id` — UpdateGenerationFlagsDto

| Field        | Type    | Required | Description                           |
| :----------- | :------ | :------- | :------------------------------------ |
| `isPublic`   | boolean | No       | Make the generation publicly visible. |
| `isFavorite` | boolean | No       | Mark the generation as a favorite.    |

## Environment Variables

```bash
FAL_KEY=fal-...
# OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash   # Optional — overrides default vision model globally
# MOCK_AI=true                                       # Optional — stub the pipeline (no OpenRouter/Fal/Cloudinary)
```
