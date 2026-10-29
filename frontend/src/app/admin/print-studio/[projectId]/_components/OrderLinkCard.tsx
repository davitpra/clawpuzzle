"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";
import {
  adminApi,
  AdminOrderDetail,
  AdminOrderItem,
  PrintProject,
} from "@/entities/admin/api";
import { fmtShortDate } from "@/entities/admin/lib/order-format";
import {
  productionStatusLabel,
  productionStatusTone,
} from "@/entities/admin/lib/production-status";
import { ItemMediaRow } from "@/app/admin/_components/ItemMediaRow";
import { LinkOrderModal } from "./LinkOrderModal";

// Pedido al que está vinculado el proyecto: imagen generada por IA y datos
// básicos, con acciones para vincular, cambiar o desvincular la línea.
export function OrderLinkCard({
  project,
  order,
  item,
  loading,
  disabled,
  onZoom,
  onChange,
}: {
  project: PrintProject;
  order: AdminOrderDetail | null;
  item: AdminOrderItem | null;
  loading: boolean;
  disabled: boolean;
  onZoom: (zoom: { src: string; title: string }) => void;
  onChange: (project: PrintProject) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  async function handleUnlink() {
    setUnlinking(true);
    try {
      onChange(await adminApi.printProjects.unlink(project.id));
      toast.success("Proyecto desvinculado. El pedido conserva su imagen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUnlinking(false);
    }
  }

  const modal = picking && (
    <LinkOrderModal
      projectId={project.id}
      currentItemId={project.orderItem?.id ?? null}
      onLinked={onChange}
      onClose={() => setPicking(false)}
    />
  );

  if (!project.orderItem) {
    return (
      <Card>
        {modal}
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Pedido
          </Text>
          <Text as="p" tone="subdued">
            Este proyecto no está vinculado a ningún pedido.
          </Text>
          <InlineStack>
            <Button
              size="slim"
              disabled={disabled}
              onClick={() => setPicking(true)}
            >
              Vincular pedido
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  if (loading || !order || !item) {
    return (
      <Card>
        {modal}
        {loading ? (
          <SkeletonBodyText lines={4} />
        ) : (
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              No se pudo cargar el pedido vinculado.
            </Text>
            <InlineStack gap="200">
              <Button
                size="slim"
                url={`/admin/orders/${project.orderItem.orderId}`}
              >
                Ver pedido
              </Button>
              <Button
                size="slim"
                loading={unlinking}
                disabled={disabled}
                onClick={handleUnlink}
              >
                Desvincular
              </Button>
            </InlineStack>
          </BlockStack>
        )}
      </Card>
    );
  }

  // Mismo fallback que la fila "Imagen generada" del pedido.
  const generatedSource = item.generation?.resultUrl ?? null;
  const generatedThumb = item.generation?.thumbnailUrl ?? generatedSource;
  const generatedFull =
    generatedSource ?? item.generation?.thumbnailUrl ?? null;
  const customerName = order.customerName ?? order.user?.fullName ?? null;
  const customerEmail = order.customerEmail ?? order.user?.email ?? null;
  const productName =
    item.productRef?.displayName ?? item.productRef?.name ?? item.title;

  return (
    <Card>
      {modal}
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text as="h2" variant="headingMd">
            Pedido {order.orderNumber}
          </Text>
          <Badge tone={productionStatusTone(item.productionStatus)}>
            {productionStatusLabel(item.productionStatus)}
          </Badge>
        </InlineStack>

        <ItemMediaRow
          image={generatedThumb}
          alt={item.title}
          onZoom={
            generatedFull
              ? () => onZoom({ src: generatedFull, title: item.title })
              : undefined
          }
        >
          <BlockStack gap="050">
            {customerName && (
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {customerName}
              </Text>
            )}
            {customerEmail && (
              <Text variant="bodySm" tone="subdued" as="span" breakWord>
                {customerEmail}
              </Text>
            )}
            <Text variant="bodySm" tone="subdued" as="span">
              {fmtShortDate(order.shopifyCreatedAt)}
            </Text>
          </BlockStack>
        </ItemMediaRow>

        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {productName}
        </Text>

        <InlineStack gap="200">
          <Button size="slim" url={`/admin/orders/${order.id}`}>
            Ver pedido
          </Button>
          <Button
            size="slim"
            disabled={disabled}
            onClick={() => setPicking(true)}
          >
            Cambiar
          </Button>
          <Button
            size="slim"
            loading={unlinking}
            disabled={disabled}
            onClick={handleUnlink}
          >
            Desvincular
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
