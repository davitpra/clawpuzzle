-- El puzzle de lanzamiento pasa de A3 vertical (5:7) a 2:3 y se imprime a
-- 20 × 30 cm, la misma proporción que el arte: el print master ya no recorta.
-- 832×1248 son ~1 MP en 2:3 exacto, múltiplos de 16 (fal los usa como `image_size`).
INSERT INTO "formats" ("id", "name", "display_name", "aspect_ratio", "width", "height", "is_active", "updated_at")
SELECT gen_random_uuid()::text, 'ratio_2_3', '2:3', '2:3', 832, 1248, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "formats" WHERE "name" = 'ratio_2_3');

-- Los productos en A3 (hoy solo `claw-puzzle`) y sus variantes pasan a 2:3, con
-- el nuevo tamaño físico. `a3_portrait` se conserva: las generaciones antiguas
-- lo referencian con sus medidas reales.
UPDATE "product_format_variants" v
SET "format_id" = (SELECT "id" FROM "formats" WHERE "name" = 'ratio_2_3'),
    "print_config" = COALESCE(v."print_config", '{}'::jsonb)
      || jsonb_build_object('widthCm', 20, 'heightCm', 30),
    "updated_at" = CURRENT_TIMESTAMP
FROM "product_references" p
WHERE v."product_ref_id" = p."id"
  AND p."format_id" = (SELECT "id" FROM "formats" WHERE "name" = 'a3_portrait');

UPDATE "product_references"
SET "format_id" = (SELECT "id" FROM "formats" WHERE "name" = 'ratio_2_3'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "format_id" = (SELECT "id" FROM "formats" WHERE "name" = 'a3_portrait');
