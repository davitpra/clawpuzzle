-- AlterTable
ALTER TABLE "product_references" ADD COLUMN "is_launch_product" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "product_references_is_launch_product_idx" ON "product_references"("is_launch_product");
