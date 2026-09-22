"use client";

import { useRouter } from "next/navigation";
import {
  Page,
  Card,
  Banner,
  Spinner,
  Text,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";
import { DeleteProductModal } from "@/app/admin/_components/DeleteProductModal";
import { ProductsTableCard } from "./_components/ProductsTableCard";
import { SpecialRoleCard } from "./_components/SpecialRoleCard";
import { SyncStatusCard } from "./_components/SyncStatusCard";
import { useProductsList } from "./useProductsList";
import { useShopifyProductMeta } from "./useShopifyProductMeta";

export default function AdminProductsPage() {
  const router = useRouter();
  const { imageMap, productTypeMap } = useShopifyProductMeta();
  const {
    products,
    styles,
    syncStatus,
    creditPackProduct,
    puzzleProducts,
    unclassifiedProducts,
    loading,
    error,
    syncing,
    toggling,
    savingStyle,
    savingTemplate,
    savingCreditPack,
    deletingTarget,
    deleting,
    setError,
    setDeletingTarget,
    handleSync,
    handleToggle,
    handleDelete,
    handleTemplateChange,
    handleStyleChange,
    handleCreditPackChange,
  } = useProductsList(productTypeMap);

  const goToProduct = (id: string) => router.push(`/admin/products/${id}`);

  // Props compartidas por la tabla de productos y la de accesorios: solo
  // difieren en la lista que reciben y en la columna de estilo.
  const tableProps = {
    styles,
    imageMap,
    productTypeMap,
    savingStyle,
    savingTemplate,
    toggling,
    onRowClick: goToProduct,
    onStyleChange: handleStyleChange,
    onTemplateChange: handleTemplateChange,
    onToggleActive: handleToggle,
    onDelete: setDeletingTarget,
  };

  return (
    <Page
      title="Productos"
      subtitle="Productos sincronizados desde Shopify"
      primaryAction={{
        content: "Sincronizar Shopify",
        icon: RefreshIcon,
        loading: syncing,
        onAction: handleSync,
      }}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {loading ? (
          <Card>
            <InlineStack align="center" gap="300">
              <Spinner size="small" />
              <Text as="span" tone="subdued">
                Cargando productos…
              </Text>
            </InlineStack>
          </Card>
        ) : (
          <>
            <ProductsTableCard
              {...tableProps}
              title="Rompecabezas"
              helpText="Productos con template Puzzle: el rompecabezas personalizado."
              products={puzzleProducts}
              showStyleColumn
            />

            <ProductsTableCard
              {...tableProps}
              title="Sin clasificar"
              helpText="Sin template asignado. Ponles Puzzle o Credits desde su ficha."
              products={unclassifiedProducts}
              showStyleColumn
              hideWhenEmpty
            />
          </>
        )}
        {!loading && (
          <>
            <SpecialRoleCard
              title="Producto Credit Pack"
              label="Producto dedicado a la venta de créditos"
              helpText="Solo puede haber uno. Configura los créditos por variante en la página del producto."
              products={products}
              selected={creditPackProduct}
              imageMap={imageMap}
              saving={savingCreditPack}
              onChange={handleCreditPackChange}
              onRowClick={goToProduct}
            />
          </>
        )}
        {syncStatus && <SyncStatusCard syncStatus={syncStatus} />}
      </BlockStack>

      <DeleteProductModal
        open={deletingTarget !== null}
        deleting={deleting}
        productName={deletingTarget?.displayName ?? ""}
        onClose={() => setDeletingTarget(null)}
        onConfirm={handleDelete}
      />
    </Page>
  );
}
