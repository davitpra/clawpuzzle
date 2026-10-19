"use client";

import { useRouter } from "next/navigation";
import { Page, Card, Banner, BlockStack } from "@shopify/polaris";
import { SortIcon } from "@shopify/polaris-icons";
import { LoadingCard } from "@/app/admin/_components/LoadingCard";
import { DeleteStyleModal } from "./_components/DeleteStyleModal";
import { StylesOrderList } from "./_components/StylesOrderList";
import { StylesTable } from "./_components/StylesTable";
import { useStylesList } from "./useStylesList";

export default function AdminStylesPage() {
  const router = useRouter();
  const {
    styles,
    generationCount,
    loading,
    error,
    toggling,
    deletingTarget,
    deleting,
    forceConfirm,
    reordering,
    savingOrder,
    setError,
    setReordering,
    setDeletingTarget,
    setForceConfirm,
    closeDeleteModal,
    handleToggle,
    handleDelete,
    saveOrder,
  } = useStylesList();

  return (
    <Page
      title="Estilos"
      subtitle="Catálogo de estilos de IA disponibles"
      secondaryActions={[
        {
          content: "Ordenar para la landing",
          icon: SortIcon,
          disabled: loading || reordering || styles.length < 2,
          onAction: () => setReordering(true),
        },
      ]}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {loading ? (
          <LoadingCard message="Cargando estilos…" />
        ) : reordering ? (
          <Card padding="0">
            <StylesOrderList
              styles={styles}
              saving={savingOrder}
              onSave={saveOrder}
              onCancel={() => setReordering(false)}
            />
          </Card>
        ) : (
          <Card padding="0">
            <StylesTable
              styles={styles}
              toggling={toggling}
              onRowClick={(id) => router.push(`/admin/styles/${id}`)}
              onToggle={handleToggle}
              onDelete={setDeletingTarget}
            />
          </Card>
        )}
      </BlockStack>

      <DeleteStyleModal
        open={deletingTarget !== null}
        deleting={deleting}
        styleName={deletingTarget?.displayName ?? ""}
        generationCount={generationCount}
        forceConfirm={forceConfirm}
        onForceConfirmChange={setForceConfirm}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
      />
    </Page>
  );
}
