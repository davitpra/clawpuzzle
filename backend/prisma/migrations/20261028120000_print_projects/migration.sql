-- Proyectos del Estudio de impresión: el trabajo de impresión sale de order_items
-- a su propia tabla, con vínculo opcional a una línea de pedido.
-- CreateTable
CREATE TABLE "print_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order_item_id" TEXT,
    "generation_id" TEXT,
    "source_url" TEXT,
    "source_storage_key" TEXT,
    "upscaled_url" TEXT,
    "upscaled_storage_key" TEXT,
    "print_image_url" TEXT,
    "print_image_storage_key" TEXT,
    "print_config" JSONB,
    "print_crop" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_projects_order_item_id_key" ON "print_projects"("order_item_id");

-- CreateIndex
CREATE INDEX "print_projects_generation_id_idx" ON "print_projects"("generation_id");

-- CreateIndex
CREATE INDEX "print_projects_updated_at_idx" ON "print_projects"("updated_at" DESC);

-- AddForeignKey
ALTER TABLE "print_projects" ADD CONSTRAINT "print_projects_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_projects" ADD CONSTRAINT "print_projects_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Un proyecto por cada línea ya trabajada en el estudio (encuadre, tamaño, base
-- agrandada o máster distinto de la fuente). La fuente no cambia de dueño: una
-- subida manual sigue siendo del ítem y una generación, de la generación.
INSERT INTO "print_projects" (
    "id", "title", "order_item_id", "generation_id", "source_url",
    "upscaled_url", "upscaled_storage_key", "print_image_url",
    "print_image_storage_key", "print_config", "print_crop",
    "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    o."order_number" || ' · ' || oi."title",
    oi."id",
    CASE
        WHEN oi."print_source_url" IS NULL OR oi."print_source_url" = g."result_url"
        THEN oi."generation_id"
    END,
    COALESCE(oi."print_source_url", g."result_url"),
    oi."print_upscaled_url",
    oi."print_upscaled_storage_key",
    CASE WHEN oi."print_image_url" IS DISTINCT FROM oi."print_source_url" THEN oi."print_image_url" END,
    CASE WHEN oi."print_image_url" IS DISTINCT FROM oi."print_source_url" THEN oi."print_image_storage_key" END,
    oi."print_config",
    oi."print_crop",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "order_items" oi
JOIN "orders" o ON o."id" = oi."order_id"
LEFT JOIN "generations" g ON g."id" = oi."generation_id"
WHERE oi."print_crop" IS NOT NULL
   OR oi."print_upscaled_url" IS NOT NULL
   OR oi."print_config" IS NOT NULL
   OR (oi."print_image_url" IS NOT NULL
       AND oi."print_source_url" IS NOT NULL
       AND oi."print_image_url" <> oi."print_source_url");

-- La base y el máster pasan a ser del proyecto: el ítem conserva la URL de su
-- imagen para impresión, pero no su key, para no borrarlos desde el pedido.
UPDATE "order_items" oi
SET "print_upscaled_url" = NULL,
    "print_upscaled_storage_key" = NULL,
    "print_image_storage_key" = CASE
        WHEN p."print_image_url" IS NOT NULL THEN NULL
        ELSE oi."print_image_storage_key"
    END
FROM "print_projects" p
WHERE p."order_item_id" = oi."id";
