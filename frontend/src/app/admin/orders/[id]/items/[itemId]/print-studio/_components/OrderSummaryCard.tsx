"use client";

import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";
import { AdminOrderDetail, AdminOrderItem } from "@/entities/admin/api";
import { fmtShortDate } from "@/entities/admin/lib/order-format";
import {
  productionStatusLabel,
  productionStatusTone,
} from "@/entities/admin/lib/production-status";
import { ItemMediaRow } from "../../../../_components/ItemMediaRow";

// Contexto del pedido al que pertenece el ítem del estudio: imagen generada por
// IA y datos básicos. Solo informativa; null = cargando.
export function OrderSummaryCard({
  order,
  item,
  onZoom,
}: {
  order: AdminOrderDetail | null;
  item: AdminOrderItem | null;
  onZoom: (zoom: { src: string; title: string }) => void;
}) {
  if (!order || !item) {
    return (
      <Card>
        <SkeletonBodyText lines={4} />
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

        <InlineStack>
          <Button size="slim" url={`/admin/orders/${order.id}`}>
            Ver pedido
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
