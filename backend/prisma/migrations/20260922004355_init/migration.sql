-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "avatar_storage_key" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "status_reason" TEXT,
    "status_changed_at" TIMESTAMP(3),
    "status_changed_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "anonymized_at" TIMESTAMP(3),
    "generation_credits" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "style" TEXT,
    "color" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "img" TEXT NOT NULL,
    "generation_id" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "age" INTEGER,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_photos" (
    "id" TEXT NOT NULL,
    "pet_id" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "photo_storage_key" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vision_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vision_model" TEXT,
    "vision_temperature" DOUBLE PRECISION,
    "system_prompt" TEXT,
    "max_tokens" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vision_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_gen_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model" TEXT,
    "parameters" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_gen_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "styles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "style_reference_url" TEXT,
    "style_reference_storage_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "strategy_key" TEXT NOT NULL DEFAULT 'style-driven-prompt',
    "prompt_template" TEXT NOT NULL,
    "template_vars" JSONB,
    "template_var_options" JSONB,
    "vision_config_id" TEXT,
    "image_gen_config_id" TEXT,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_images" (
    "id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "alt_image" TEXT,
    "order_index" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formats" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "print_width_cm" DOUBLE PRECISION,
    "print_height_cm" DOUBLE PRECISION,
    "piece_count" INTEGER,
    "shopify_variant_option" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_references" (
    "id" TEXT NOT NULL,
    "shopify_product_id" TEXT NOT NULL,
    "shopify_handle" TEXT,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "style_id" TEXT,
    "template" TEXT,
    "showcase_collection_handle" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_credit_pack" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_format_variants" (
    "id" TEXT NOT NULL,
    "product_ref_id" TEXT NOT NULL,
    "format_id" TEXT NOT NULL,
    "shopify_variant_id" TEXT NOT NULL,
    "shopify_variant_title" TEXT NOT NULL,
    "constraints" JSONB,
    "print_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_format_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_pack_variants" (
    "id" TEXT NOT NULL,
    "product_ref_id" TEXT NOT NULL,
    "shopify_variant_id" TEXT NOT NULL,
    "credit_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_pack_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pet_id" TEXT,
    "pet_photo_id" TEXT,
    "style_id" TEXT NOT NULL,
    "format_id" TEXT,
    "product_ref_id" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "negative_prompt" TEXT,
    "result_url" TEXT,
    "result_storage_key" TEXT,
    "thumbnail_url" TEXT,
    "provider" TEXT NOT NULL,
    "processing_time_seconds" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "vision_analysis" JSONB,
    "final_prompt" TEXT,
    "fal_request_id" TEXT,
    "prompt_snapshot" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_admin_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "shopify_order_id" TEXT NOT NULL,
    "shopify_order_gid" TEXT,
    "order_number" TEXT NOT NULL,
    "user_id" TEXT,
    "customer_email" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "financial_status" TEXT,
    "fulfillment_status" TEXT,
    "fulfillment_display_status" TEXT,
    "order_status_url" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal_amount" DECIMAL(10,2) NOT NULL,
    "shipping_amount" DECIMAL(10,2),
    "tax_amount" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "shipping_address" JSONB,
    "billing_address" JSONB,
    "customer_note" TEXT,
    "shopify_created_at" TIMESTAMP(3) NOT NULL,
    "shopify_updated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "production_cost" DECIMAL(10,2),
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "shopify_line_item_id" TEXT NOT NULL,
    "shopify_variant_id" TEXT,
    "shopify_product_id" TEXT,
    "product_ref_id" TEXT,
    "product_format_variant_id" TEXT,
    "generation_id" TEXT,
    "title" TEXT NOT NULL,
    "variant_title" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "image_url" TEXT,
    "print_image_url" TEXT,
    "print_image_storage_key" TEXT,
    "print_source_url" TEXT,
    "print_source_storage_key" TEXT,
    "print_upscaled_url" TEXT,
    "print_upscaled_storage_key" TEXT,
    "style" TEXT,
    "size" TEXT,
    "production_status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT,
    "event_type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "payload" JSONB,
    "user_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "user_id" TEXT,
    "order_id" TEXT,
    "order_item_id" TEXT,
    "generation_id" TEXT,
    "provider" TEXT,
    "provider_ref" TEXT,
    "amount" DECIMAL(12,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount_base" DECIMAL(12,6),
    "base_currency" TEXT,
    "fx_rate" DECIMAL(12,6),
    "detail" JSONB,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "created_by" TEXT,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_rates" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "amount" DECIMAL(12,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "provider_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "products_checked" INTEGER,
    "products_created" INTEGER,
    "products_updated" INTEGER,
    "products_deactivated" INTEGER,
    "errors" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_google_id_idx" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);

-- CreateIndex
CREATE INDEX "users_last_seen_at_idx" ON "users"("last_seen_at" DESC);

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at" DESC);

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_reason_reference_id_key" ON "credit_transactions"("reason", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_last_used_at_idx" ON "refresh_tokens"("user_id", "last_used_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "pets_user_id_idx" ON "pets"("user_id");

-- CreateIndex
CREATE INDEX "pets_species_idx" ON "pets"("species");

-- CreateIndex
CREATE INDEX "pets_user_id_is_active_idx" ON "pets"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "pet_photos_pet_id_idx" ON "pet_photos"("pet_id");

-- CreateIndex
CREATE INDEX "pet_photos_pet_id_is_primary_idx" ON "pet_photos"("pet_id", "is_primary");

-- CreateIndex
CREATE INDEX "pet_photos_pet_id_order_index_idx" ON "pet_photos"("pet_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "vision_configs_name_key" ON "vision_configs"("name");

-- CreateIndex
CREATE INDEX "vision_configs_is_active_idx" ON "vision_configs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "image_gen_configs_name_key" ON "image_gen_configs"("name");

-- CreateIndex
CREATE INDEX "image_gen_configs_is_active_idx" ON "image_gen_configs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "styles_name_key" ON "styles"("name");

-- CreateIndex
CREATE INDEX "styles_category_idx" ON "styles"("category");

-- CreateIndex
CREATE INDEX "styles_is_active_idx" ON "styles"("is_active");

-- CreateIndex
CREATE INDEX "styles_category_is_active_idx" ON "styles"("category", "is_active");

-- CreateIndex
CREATE INDEX "styles_vision_config_id_idx" ON "styles"("vision_config_id");

-- CreateIndex
CREATE INDEX "styles_image_gen_config_id_idx" ON "styles"("image_gen_config_id");

-- CreateIndex
CREATE INDEX "style_images_style_id_idx" ON "style_images"("style_id");

-- CreateIndex
CREATE INDEX "style_images_style_id_order_index_idx" ON "style_images"("style_id", "order_index");

-- CreateIndex
CREATE INDEX "style_images_style_id_is_primary_idx" ON "style_images"("style_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "formats_name_key" ON "formats"("name");

-- CreateIndex
CREATE INDEX "formats_is_active_idx" ON "formats"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_references_shopify_product_id_key" ON "product_references"("shopify_product_id");

-- CreateIndex
CREATE INDEX "product_references_is_active_idx" ON "product_references"("is_active");

-- CreateIndex
CREATE INDEX "product_references_style_id_idx" ON "product_references"("style_id");

-- CreateIndex
CREATE INDEX "product_references_is_credit_pack_idx" ON "product_references"("is_credit_pack");

-- CreateIndex
CREATE INDEX "product_format_variants_shopify_variant_id_idx" ON "product_format_variants"("shopify_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_format_variants_product_ref_id_shopify_variant_id_key" ON "product_format_variants"("product_ref_id", "shopify_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_pack_variants_shopify_variant_id_key" ON "credit_pack_variants"("shopify_variant_id");

-- CreateIndex
CREATE INDEX "credit_pack_variants_product_ref_id_idx" ON "credit_pack_variants"("product_ref_id");

-- CreateIndex
CREATE INDEX "generations_user_id_idx" ON "generations"("user_id");

-- CreateIndex
CREATE INDEX "generations_pet_id_idx" ON "generations"("pet_id");

-- CreateIndex
CREATE INDEX "generations_pet_photo_id_idx" ON "generations"("pet_photo_id");

-- CreateIndex
CREATE INDEX "generations_status_idx" ON "generations"("status");

-- CreateIndex
CREATE INDEX "generations_type_idx" ON "generations"("type");

-- CreateIndex
CREATE INDEX "generations_user_id_status_idx" ON "generations"("user_id", "status");

-- CreateIndex
CREATE INDEX "generations_user_id_type_idx" ON "generations"("user_id", "type");

-- CreateIndex
CREATE INDEX "generations_created_at_idx" ON "generations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "generations_style_id_is_admin_test_idx" ON "generations"("style_id", "is_admin_test");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_shopify_order_id_key" ON "orders"("shopify_order_id");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_customer_email_idx" ON "orders"("customer_email");

-- CreateIndex
CREATE INDEX "orders_shopify_created_at_idx" ON "orders"("shopify_created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_financial_status_idx" ON "orders"("financial_status");

-- CreateIndex
CREATE INDEX "orders_user_id_shopify_created_at_idx" ON "orders"("user_id", "shopify_created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_generation_id_idx" ON "order_items"("generation_id");

-- CreateIndex
CREATE INDEX "order_items_production_status_idx" ON "order_items"("production_status");

-- CreateIndex
CREATE INDEX "order_items_product_ref_id_idx" ON "order_items"("product_ref_id");

-- CreateIndex
CREATE INDEX "order_items_created_at_idx" ON "order_items"("created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_shipped_at_idx" ON "order_items"("shipped_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_delivered_at_idx" ON "order_items"("delivered_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_shopify_line_item_id_key" ON "order_items"("order_id", "shopify_line_item_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_events_order_item_id_idx" ON "order_events"("order_item_id");

-- CreateIndex
CREATE INDEX "order_events_created_at_idx" ON "order_events"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_dedupe_key_key" ON "expenses"("dedupe_key");

-- CreateIndex
CREATE INDEX "expenses_order_id_idx" ON "expenses"("order_id");

-- CreateIndex
CREATE INDEX "expenses_user_id_idx" ON "expenses"("user_id");

-- CreateIndex
CREATE INDEX "expenses_generation_id_idx" ON "expenses"("generation_id");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_category_created_at_idx" ON "expenses"("category", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "provider_rates_provider_model_key" ON "provider_rates"("provider", "model");

-- CreateIndex
CREATE INDEX "sync_logs_type_idx" ON "sync_logs"("type");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs"("started_at" DESC);

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_vision_config_id_fkey" FOREIGN KEY ("vision_config_id") REFERENCES "vision_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_image_gen_config_id_fkey" FOREIGN KEY ("image_gen_config_id") REFERENCES "image_gen_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_images" ADD CONSTRAINT "style_images_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_references" ADD CONSTRAINT "product_references_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_format_variants" ADD CONSTRAINT "product_format_variants_product_ref_id_fkey" FOREIGN KEY ("product_ref_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_format_variants" ADD CONSTRAINT "product_format_variants_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_pack_variants" ADD CONSTRAINT "credit_pack_variants_product_ref_id_fkey" FOREIGN KEY ("product_ref_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_pet_photo_id_fkey" FOREIGN KEY ("pet_photo_id") REFERENCES "pet_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_product_ref_id_fkey" FOREIGN KEY ("product_ref_id") REFERENCES "product_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_ref_id_fkey" FOREIGN KEY ("product_ref_id") REFERENCES "product_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_format_variant_id_fkey" FOREIGN KEY ("product_format_variant_id") REFERENCES "product_format_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
