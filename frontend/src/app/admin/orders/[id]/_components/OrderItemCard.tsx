"use client";

import { useRef, useState } from "react";
import {
  Card,
  Banner,
  Text,
  BlockStack,
  Divider,
  Button,
  Box,
  InlineStack,
} from "@shopify/polaris";
import { adminApi, AdminOrderItem } from "@/entities/admin/api";
import { VALID_TRANSITIONS } from "@/entities/admin/lib/order-transitions";
import ImagePreviewModal from "@/app/admin/_components/ImagePreviewModal";
import { Modal } from "@shopify/polaris";
import { ItemActionsBar } from "./ItemActionsBar";
import { ItemFulfillmentControl } from "./ItemFulfillmentControl";
import { ItemMediaRow } from "./ItemMediaRow";
import { ItemProductPreview } from "./ItemProductPreview";
import { ItemProductSummaryRow } from "./ItemProductSummaryRow";
import { ItemStatusSelect } from "./ItemStatusSelect";
import { GenerationActionsBar } from "./GenerationActionsBar";
import { GenerationPickerModal } from "./GenerationPickerModal";

type OrderItemCardProps = {
  item: AdminOrderItem;
  orderId: string;
  userId: string | null;
  currency: string;
  shopifyImageUrl?: string | null;
  onUpdate: () => void;
  onRequestCancel: (itemIds: string[]) => void;
};

export function OrderItemCard({
  item,
  orderId,
  userId,
  currency,
  shopifyImageUrl,
  onUpdate,
  onRequestCancel,
}: OrderItemCardProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "in_house" | "pod"
  >(item.fulfillmentMethod as "in_house" | "pod");
  const [savingFulfillment, setSavingFulfillment] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [confirmRemoveImage, setConfirmRemoveImage] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Estado de la fila "Imagen generada".
  const [replacingGeneration, setReplacingGeneration] = useState(false);
  const [unlinkingGeneration, setUnlinkingGeneration] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingGenFile, setPendingGenFile] = useState<File | null>(null);
  const genFileInputRef = useRef<HTMLInputElement>(null);

  // Imagen del producto de Shopify relacionado: imagen de la variante comprada
  // (live desde Shopify) → preview del estilo. No cae al arte del cliente.
  const productImage =
    shopifyImageUrl ?? item.productRef?.style?.images?.[0]?.imageUrl ?? null;
  // IA art original.
  const generatedSource = item.generation?.resultUrl ?? null;
  const generatedThumb = item.generation?.thumbnailUrl ?? generatedSource;
  const generatedFull =
    generatedSource ?? item.generation?.thumbnailUrl ?? null;
  // Imagen final para impresión. El estudio arranca desde el diseño generado por
  // el cliente, así que mientras no exista la imagen procesada mostramos esa
  // generación como vista previa (marcada "Sin procesar"). Mismo orden de fallback
  // que el Print Studio.
  const printThumb =
    item.printImageUrl ?? generatedThumb ?? item.imageUrl ?? null;
  const printFull =
    item.printImageUrl ?? generatedFull ?? item.imageUrl ?? null;
  const printIsPreliminary =
    !item.printImageUrl && Boolean(generatedThumb ?? item.imageUrl);
  const allowed = VALID_TRANSITIONS[item.productionStatus] ?? [];

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      setErr("El archivo debe ser una imagen");
      return;
    }
    setUploadingImage(true);
    setErr(null);
    try {
      await adminApi.orders.uploadPrintImage(orderId, item.id, file);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploadingImage(false);
    }
  }

  // Borrar la imagen final elimina el master procesado; el item vuelve a mostrar
  // la imagen generada como vista previa.
  async function handleRemoveImage() {
    setRemovingImage(true);
    setErr(null);
    try {
      await adminApi.orders.removePrintImage(orderId, item.id);
      setConfirmRemoveImage(false);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRemovingImage(false);
    }
  }

  // Si hay generación, la subida la sobrescribe, así que pedimos confirmación
  // antes: guardamos el archivo elegido y mostramos el diálogo. Sin generación
  // (pedidos comprados directo en Shopify) no hay nada que perder: el backend
  // crea una y subimos directo.
  function handleGenerationFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      setErr("El archivo debe ser una imagen");
      return;
    }
    if (item.generation) {
      setPendingGenFile(file);
    } else {
      uploadGeneration(file);
    }
  }

  async function uploadGeneration(file: File) {
    setReplacingGeneration(true);
    setErr(null);
    try {
      await adminApi.orders.uploadGenerationImage(orderId, item.id, file);
      setPendingGenFile(null);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setReplacingGeneration(false);
    }
  }

  function handleConfirmReplaceGeneration() {
    if (pendingGenFile) uploadGeneration(pendingGenFile);
  }

  async function handleUnlinkGeneration() {
    setUnlinkingGeneration(true);
    setErr(null);
    try {
      await adminApi.orders.unlinkGeneration(orderId, item.id);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUnlinkingGeneration(false);
    }
  }

  async function handleFulfillmentChange(value: string) {
    const method = value as "in_house" | "pod";
    setFulfillmentMethod(method);
    setSavingFulfillment(true);
    setErr(null);
    try {
      await adminApi.orders.updateItemFulfillment(orderId, item.id, method);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
      setFulfillmentMethod(item.fulfillmentMethod as "in_house" | "pod");
    } finally {
      setSavingFulfillment(false);
    }
  }

  async function handleStatusChange(toStatus: string) {
    setUpdatingStatus(true);
    setErr(null);
    try {
      await adminApi.orders.updateItemStatus(orderId, item.id, toStatus);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function handleStatusSelect(value: string) {
    if (value === "cancelled") {
      onRequestCancel([item.id]);
    } else {
      handleStatusChange(value);
    }
  }

  return (
    <>
      {previewSrc && (
        <ImagePreviewModal
          src={previewSrc}
          title={item.title}
          onClose={() => setPreviewSrc(null)}
        />
      )}
      {showPicker && userId && (
        <GenerationPickerModal
          userId={userId}
          orderId={orderId}
          itemId={item.id}
          currentGenerationId={item.generation?.id ?? null}
          onClose={() => setShowPicker(false)}
          onLinked={onUpdate}
        />
      )}
      {pendingGenFile && (
        <Modal
          open
          onClose={() => setPendingGenFile(null)}
          title="Reemplazar imagen generada"
          primaryAction={{
            content: "Reemplazar",
            destructive: true,
            loading: replacingGeneration,
            onAction: handleConfirmReplaceGeneration,
          }}
          secondaryActions={[
            {
              content: "Cancelar",
              onAction: () => setPendingGenFile(null),
              disabled: replacingGeneration,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Esto sobrescribe la imagen de la generación del cliente. La nueva
              imagen también aparecerá en su galería. ¿Continuar?
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {confirmRemoveImage && (
        <Modal
          open
          onClose={() => setConfirmRemoveImage(false)}
          title="Borrar imagen final"
          primaryAction={{
            content: "Borrar",
            destructive: true,
            loading: removingImage,
            onAction: handleRemoveImage,
          }}
          secondaryActions={[
            {
              content: "Cancelar",
              onAction: () => setConfirmRemoveImage(false),
              disabled: removingImage,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Esto borra la imagen para impresión, incluido lo procesado en el
              Print Studio. El item vuelve a usar la imagen generada. ¿Continuar?
            </Text>
          </Modal.Section>
        </Modal>
      )}

      <ItemFulfillmentControl
        value={fulfillmentMethod}
        disabled={savingFulfillment}
        onChange={handleFulfillmentChange}
        productionStatus={item.productionStatus}
      />

      <Card>
        <BlockStack gap="300">
          <ItemProductSummaryRow
            item={item}
            image={productImage}
            currency={currency}
          />

          <Divider />

          <GenerationActionsBar
            hasGeneration={!!item.generation}
            canPickGeneration={!!userId}
            replacing={replacingGeneration}
            unlinking={unlinkingGeneration}
            fileInputRef={genFileInputRef}
            onReplaceClick={() => genFileInputRef.current?.click()}
            onReplaceChange={handleGenerationFileChange}
            onPickClick={() => setShowPicker(true)}
            onUnlinkClick={handleUnlinkGeneration}
          />

          <ItemMediaRow
            image={generatedThumb}
            alt={item.title}
            onZoom={
              generatedFull ? () => setPreviewSrc(generatedFull) : undefined
            }
          >
            <BlockStack gap="050">
              <Text variant="bodySm" tone="subdued" as="span">
                Imagen generada
              </Text>
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {item.title}
              </Text>
              {item.variantTitle && (
                <Text variant="bodySm" tone="subdued" as="span">
                  {item.variantTitle}
                </Text>
              )}
              <Text variant="bodySm" tone="subdued" as="span">
                {item.id}
              </Text>
              {generatedSource && (
                <Button
                  size="micro"
                  url={`/admin/orders/${orderId}/items/${item.id}/print-studio`}
                >
                  Preparar para impresión
                </Button>
              )}
            </BlockStack>
          </ItemMediaRow>

          {/* Carta del producto final para imprimir, separada visualmente del resto. */}
          <Box
            background="bg-surface-secondary"
            borderColor="border"
            borderWidth="025"
            borderRadius="300"
            padding="400"
          >
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h3">
                  Imagen para impresión
                </Text>
                <ItemActionsBar
                  hasPrintImage={!!item.printImageUrl}
                  uploading={uploadingImage}
                  removing={removingImage}
                  fileInputRef={fileInputRef}
                  onUploadClick={() => fileInputRef.current?.click()}
                  onUploadChange={handleUploadImage}
                  onRemoveClick={() => setConfirmRemoveImage(true)}
                />
              </InlineStack>
              <ItemProductPreview
                image={printThumb}
                alt={item.title}
                size={item.size}
                preliminary={printIsPreliminary}
                onZoom={printFull ? () => setPreviewSrc(printFull) : undefined}
              />
            </BlockStack>
          </Box>

          {err && (
            <Banner tone="critical" onDismiss={() => setErr(null)}>
              {err}
            </Banner>
          )}

          {allowed.length > 0 && (
            <>
              <Divider />
              <ItemStatusSelect
                allowed={allowed}
                disabled={updatingStatus}
                onSelect={handleStatusSelect}
              />
            </>
          )}
        </BlockStack>
      </Card>
    </>
  );
}
