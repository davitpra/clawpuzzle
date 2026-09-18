"use client";

import {
  Card,
  Badge,
  Text,
  InlineStack,
  BlockStack,
  Divider,
} from "@shopify/polaris";
import { AdminOrderDetail } from "@/entities/admin/api";
import { fmtCurrency } from "@/entities/admin/lib/order-format";
import {
  resolveFulfillmentStatus,
  fulfillmentLabel,
  fulfillmentTone,
} from "@/entities/admin/lib/fulfillment-status";
import {
  financialLabel,
  financialTone,
} from "@/entities/admin/lib/financial-status";
import { ProductionCostSection } from "./ProductionCostSection";
import { OrderExpensesSection } from "./OrderExpensesSection";

type OrderTotalsCardProps = {
  order: AdminOrderDetail;
  orderId: string;
  onUpdate: () => void;
};

// Fila etiqueta/valor de los totales. Usamos InlineStack en vez de
// DescriptionList porque su columna de término es estrecha y parte "Impuestos".
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <InlineStack align="space-between">
      <Text as="span" tone="subdued">
        {label}
      </Text>
      <Text as="span">{value}</Text>
    </InlineStack>
  );
}

export function OrderTotalsCard({
  order,
  orderId,
  onUpdate,
}: OrderTotalsCardProps) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingMd" as="h2">
          Totales
        </Text>
        <BlockStack gap="200">
          <TotalRow
            label="Subtotal"
            value={fmtCurrency(order.subtotalAmount, order.currency)}
          />
          {order.shippingAmount != null && (
            <TotalRow
              label="Envío"
              value={fmtCurrency(order.shippingAmount, order.currency)}
            />
          )}
          {order.taxAmount != null && (
            <TotalRow
              label="Impuestos"
              value={fmtCurrency(order.taxAmount, order.currency)}
            />
          )}
        </BlockStack>
        <Divider />
        <InlineStack align="space-between">
          <Text variant="headingSm" fontWeight="bold" as="span">
            Total
          </Text>
          <Text variant="headingSm" fontWeight="bold" as="span">
            {fmtCurrency(order.totalAmount, order.currency)}
          </Text>
        </InlineStack>
        <Divider />
        <ProductionCostSection
          order={order}
          orderId={orderId}
          onUpdate={onUpdate}
        />
        <Divider />
        <OrderExpensesSection orderId={orderId} />
        <Divider />
        <InlineStack gap="200">
          {order.financialStatus && (
            <Badge tone={financialTone(order.financialStatus)}>
              {financialLabel(order.financialStatus)}
            </Badge>
          )}
          {(() => {
            const fulfillment = resolveFulfillmentStatus({
              fulfillmentDisplayStatus: order.fulfillmentDisplayStatus,
              fulfillmentStatus: order.fulfillmentStatus,
            });
            return (
              <Badge tone={fulfillmentTone(fulfillment)}>
                {fulfillmentLabel(fulfillment)}
              </Badge>
            );
          })()}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
