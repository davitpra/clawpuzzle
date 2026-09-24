"use client";

import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Select,
  Divider,
  Thumbnail,
} from "@shopify/polaris";
import { AdminFormat, AdminProduct, AdminStyle } from "@/entities/admin/api";

type ProductDetailsSidebarProps = {
  product: AdminProduct;
  styles: AdminStyle[];
  styleId: string;
  onStyleChange: (value: string) => void;
  formats: AdminFormat[];
  formatId: string;
  onFormatChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
};

export function ProductDetailsSidebar({
  product,
  styles,
  styleId,
  onStyleChange,
  formats,
  formatId,
  onFormatChange,
  saving,
  onSave,
}: ProductDetailsSidebarProps) {
  const assignedStyle = styles.find((s) => s.id === styleId);

  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingSm" as="h2">
          Detalles
        </Text>
        <Select
          label="Estilo asignado"
          options={[
            { label: "Sin asignar", value: "" },
            ...styles.map((s) => ({
              label: s.displayName,
              value: s.id,
            })),
          ]}
          value={styleId}
          onChange={onStyleChange}
        />
        {assignedStyle?.previewUrl && (
          <InlineStack gap="200" blockAlign="center">
            <Thumbnail
              source={assignedStyle.previewUrl}
              alt={assignedStyle.displayName}
              size="medium"
            />
            <Text variant="bodySm" tone="subdued" as="span">
              Vista previa del estilo
            </Text>
          </InlineStack>
        )}
        <Select
          label="Formato (proporción)"
          options={[
            { label: "Sin asignar", value: "", disabled: true },
            ...formats.map((f) => ({
              label: `${f.displayName} (${f.aspectRatio})`,
              value: f.id,
            })),
          ]}
          value={formatId}
          onChange={onFormatChange}
          helpText="Proporción de la imagen a generar. La heredan todas las variantes."
        />
        <InlineStack align="end">
          <Button variant="primary" loading={saving} onClick={onSave}>
            Guardar cambios
          </Button>
        </InlineStack>
        <Divider />
        <BlockStack gap="150">
          <Text variant="bodySm" as="span" fontWeight="bold">
            Nombre
          </Text>
          <Text as="p" fontWeight="regular">
            {product.displayName}
          </Text>
        </BlockStack>
        {product.description && (
          <BlockStack gap="150">
            <Text variant="bodySm" as="span" fontWeight="bold">
              Descripción
            </Text>
            <Text as="p">{product.description}</Text>
          </BlockStack>
        )}
        <BlockStack gap="150">
          <Text variant="bodySm" as="span" fontWeight="bold">
            Handle Shopify
          </Text>
          <Text as="p">{product.shopifyHandle ?? "—"}</Text>
        </BlockStack>
        <BlockStack gap="150">
          <Text variant="bodySm" as="span" fontWeight="bold">
            Shopify Product ID
          </Text>
          <Text as="p">{product.shopifyProductId ?? "—"}</Text>
        </BlockStack>
        <BlockStack gap="150">
          <Text variant="bodySm" as="span" fontWeight="bold">
            Estado
          </Text>
          <Badge tone={product.isActive ? "success" : "enabled"}>
            {product.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
