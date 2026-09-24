-- El formato pasa a ser solo la proporción de la imagen generada. El número de
-- piezas y el tamaño físico dejan de vivir en `formats`: el tamaño es de cada
-- variante (`product_format_variants.print_config`) y la proporción la fija el
-- producto (`product_references.format_id`), que la heredan sus variantes.

-- AlterTable
ALTER TABLE "product_references" ADD COLUMN     "format_id" TEXT;

-- CreateIndex
CREATE INDEX "product_references_format_id_idx" ON "product_references"("format_id");

-- AddForeignKey
ALTER TABLE "product_references" ADD CONSTRAINT "product_references_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conserva el tamaño físico que solo estaba en el formato: pasa al print_config
-- de las variantes que no lo tenían.
UPDATE "product_format_variants" v
SET "print_config" = COALESCE(v."print_config", '{}'::jsonb)
  || jsonb_build_object('widthCm', f."print_width_cm", 'heightCm', f."print_height_cm")
FROM "formats" f
WHERE v."format_id" = f."id"
  AND f."print_width_cm" IS NOT NULL
  AND f."print_height_cm" IS NOT NULL
  AND (v."print_config" IS NULL OR NOT (v."print_config" ? 'widthCm'));

-- El catch-all "Default Title" ya era, de hecho, el formato 4:3 de todo el catálogo.
UPDATE "formats"
SET "name" = 'ratio_4_3', "display_name" = '4:3'
WHERE "name" = 'default_title'
  AND NOT EXISTS (SELECT 1 FROM "formats" WHERE "name" = 'ratio_4_3');

-- Cada producto hereda el formato que ya usaban sus variantes (la activa más reciente).
UPDATE "product_references" p
SET "format_id" = (
  SELECT v."format_id"
  FROM "product_format_variants" v
  WHERE v."product_ref_id" = p."id"
  ORDER BY v."is_active" DESC, v."updated_at" DESC
  LIMIT 1
);

-- AlterTable
ALTER TABLE "formats" DROP COLUMN "piece_count",
DROP COLUMN "print_height_cm",
DROP COLUMN "print_width_cm",
DROP COLUMN "shopify_variant_option";
