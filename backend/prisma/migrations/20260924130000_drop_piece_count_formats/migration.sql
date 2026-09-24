-- Los formatos por número de piezas quedaron obsoletos al pasar el formato a
-- ser solo la proporción (ver 20260924120000_format_by_aspect_ratio). Solo se
-- borran si nada los referencia: una generación, variante o producto que aún
-- apunte a uno lo conserva en vez de hacer fallar la migración.
DELETE FROM "formats" f
WHERE f."name" IN ('puzzle_300', 'puzzle_500', 'puzzle_1000')
  AND NOT EXISTS (SELECT 1 FROM "generations" g WHERE g."format_id" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "product_format_variants" v WHERE v."format_id" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "product_references" p WHERE p."format_id" = f."id");
