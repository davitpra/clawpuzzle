"use client";

import { Badge, Card, InlineStack, Text } from "@shopify/polaris";
import { AdminOrderItem } from "@/entities/admin/api";
import { ItemProductSummaryRow } from "./ItemProductSummaryRow";

type SimpleOrderItemCardProps = {
  item: AdminOrderItem;
  currency: string;
  shopifyImageUrl?: string | null;
};

// Card de los packs de créditos: no tienen generación ni imagen para
// impresión, y no se producen ni se envían (se acreditan al pagarse), así que
// se muestran como una sola fila de producto sin controles, en vez de la card
// completa de `OrderItemCard`.
export function SimpleOrderItemCard({
  item,
  currency,
  shopifyImageUrl,
}: SimpleOrderItemCardProps) {
  // Imagen live de la variante comprada → imagen del estilo → miniatura persistida.
  // Mismo orden que `resolveItemImage` del dashboard de usuario.
  const image =
    shopifyImageUrl ??
    item.productRef?.style?.images?.[0]?.imageUrl ??
    item.imageUrl ??
    null;

  return (
    <Card>
      <ItemProductSummaryRow item={item} image={image} currency={currency}>
        <InlineStack gap="150" blockAlign="center">
          <Badge tone="info">Créditos</Badge>
          {item.creditAmount !== null && (
            <Text variant="bodySm" tone="subdued" as="span">
              {item.creditAmount * item.quantity} créditos abonados
            </Text>
          )}
        </InlineStack>
      </ItemProductSummaryRow>
    </Card>
  );
}
