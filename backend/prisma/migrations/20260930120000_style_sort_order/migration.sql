-- AlterTable
ALTER TABLE "styles" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: conserva el orden que ya se veía (categoría, nombre visible)
UPDATE "styles" AS s
SET "sort_order" = o.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "category", "display_name") - 1 AS rn
  FROM "styles"
) AS o
WHERE s."id" = o."id";

-- CreateIndex
CREATE INDEX "styles_sort_order_idx" ON "styles"("sort_order");
