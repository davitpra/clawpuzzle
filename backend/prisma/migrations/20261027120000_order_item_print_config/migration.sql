-- Tamaño de impresión por línea, elegido en el Print Studio. Anula el
-- printConfig de la variante solo para este item.
ALTER TABLE "order_items" ADD COLUMN "print_config" JSONB;
