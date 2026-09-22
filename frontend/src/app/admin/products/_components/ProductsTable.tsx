"use client";

import {
  IndexTable,
  Button,
  Spinner,
  Text,
  InlineStack,
  BlockStack,
  Select,
  Thumbnail,
} from "@shopify/polaris";
import { DeleteIcon, ImageIcon } from "@shopify/polaris-icons";
import { AdminProduct, AdminStyle } from "@/entities/admin/api";
import { ActiveToggleBadge } from "@/app/admin/_components/ActiveToggleBadge";
import {
  normalizeTemplate,
} from "@/entities/product/lib/template";
import { SortColumn, useTableSort } from "@/hooks/useTableSort";

// El template es el tipo de producto del storefront. ClawPuzzle vende dos
// cosas, así que la lista es corta: el rompecabezas y los packs de créditos.
export const TEMPLATE_OPTIONS = [
  { label: "Por defecto", value: "" },
  { label: "Puzzle", value: "Puzzle" },
  { label: "Credits", value: "Credits" },
];

/** Valores de template que el Select acepta (sin la opción vacía "Por defecto"). */
const VALID_TEMPLATES = new Set(
  TEMPLATE_OPTIONS.map((o) => o.value).filter(Boolean),
);

/**
 * Template efectivo de un producto: el template guardado; si no, el
 * `productType` de Shopify (solo si es una opción válida); si no, "".
 * Compartido entre la partición de la página y el default del Select.
 */
export function resolveTemplate(
  p: Pick<AdminProduct, "template" | "shopifyHandle">,
  productTypeMap: Record<string, string>,
): string {
  if (p.template) return normalizeTemplate(p.template);
  const shopifyType = normalizeTemplate(
    p.shopifyHandle ? productTypeMap[p.shopifyHandle] : undefined,
  );
  return VALID_TEMPLATES.has(shopifyType) ? shopifyType : "";
}

interface ProductsTableProps {
  products: AdminProduct[];
  styles: AdminStyle[];
  imageMap: Record<string, string>;
  /** Mapa handle → productType de Shopify, usado como default del template. */
  productTypeMap: Record<string, string>;
  /** La tabla de accesorios no asigna estilo, así que oculta esa columna. */
  showStyleColumn?: boolean;
  savingStyle: string | null;
  savingTemplate: string | null;
  toggling: string | null;
  onRowClick: (id: string) => void;
  onStyleChange: (productId: string, styleId: string) => void;
  onTemplateChange: (productId: string, value: string) => void;
  onToggleActive: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
}

/**
 * Tabla de productos compartida por la card de productos (con estilo asignado)
 * y la de accesorios. Ambas comparten columnas salvo "Estilo asignado".
 */
export function ProductsTable({
  products,
  styles,
  imageMap,
  productTypeMap,
  showStyleColumn = false,
  savingStyle,
  savingTemplate,
  toggling,
  onRowClick,
  onStyleChange,
  onTemplateChange,
  onToggleActive,
  onDelete,
}: ProductsTableProps) {
  // Se ordena por el valor que muestra la celda (el label del template, el del
  // contenido, el nombre del estilo), no por el campo crudo, para que lo que se
  // ve sea lo que se ordena. El hook vive dentro de la tabla, así que las dos
  // instancias (productos y accesorios) llevan su orden por separado.
  const columns: SortColumn<AdminProduct>[] = [
    { title: "Producto", sortBy: (p) => p.displayName },
    ...(showStyleColumn
      ? [
          {
            title: "Estilo asignado",
            sortBy: (p: AdminProduct) => p.style?.displayName,
          },
        ]
      : []),
    { title: "Template", sortBy: (p) => resolveTemplate(p, productTypeMap) },
    {
      title: "Estado",
      sortBy: (p) => p.isActive,
      defaultSortDirection: "descending",
    },
    { title: "Acciones" },
  ];

  const { rows, headings, sortProps } = useTableSort(products, columns);

  return (
    <IndexTable
      resourceName={{ singular: "producto", plural: "productos" }}
      itemCount={rows.length}
      headings={headings}
      {...sortProps}
      selectable={false}
    >
      {rows.map((p, index) => (
        <IndexTable.Row
          id={p.id}
          key={p.id}
          position={index}
          tone={p.isActive ? undefined : "subdued"}
          onClick={() => onRowClick(p.id)}
        >
          <IndexTable.Cell>
            <InlineStack gap="300" blockAlign="center">
              <Thumbnail
                source={
                  (p.shopifyHandle && imageMap[p.shopifyHandle]) || ImageIcon
                }
                alt={p.displayName}
                size="small"
              />
              <BlockStack gap="0">
                <Text variant="bodyMd" fontWeight="semibold" as="span">
                  {p.displayName}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {p.name}
                </Text>
              </BlockStack>
            </InlineStack>
          </IndexTable.Cell>

          {showStyleColumn && (
            <IndexTable.Cell>
              <div onClick={(e) => e.stopPropagation()}>
                <InlineStack gap="200" blockAlign="center">
                  <div style={{ minWidth: 180 }}>
                    <Select
                      label=""
                      labelHidden
                      disabled={savingStyle === p.id}
                      value={p.styleId ?? ""}
                      onChange={(value) => onStyleChange(p.id, value)}
                      options={[
                        { label: "Sin asignar", value: "" },
                        ...styles.map((s) => ({
                          label: s.displayName,
                          value: s.id,
                        })),
                      ]}
                    />
                  </div>
                  {savingStyle === p.id && <Spinner size="small" />}
                </InlineStack>
              </div>
            </IndexTable.Cell>
          )}

          <IndexTable.Cell>
            {(
              <div onClick={(e) => e.stopPropagation()}>
                <InlineStack gap="200" blockAlign="center">
                  <div style={{ minWidth: 150 }}>
                    <Select
                      label=""
                      labelHidden
                      disabled={savingTemplate === p.id}
                      value={resolveTemplate(p, productTypeMap)}
                      onChange={(value) => onTemplateChange(p.id, value)}
                      helpText={
                        // El valor mostrado viene del productType de Shopify, no de
                        // un template guardado: avisamos que es heredado.
                        !p.template && resolveTemplate(p, productTypeMap)
                          ? "Heredado de Shopify"
                          : undefined
                      }
                      options={TEMPLATE_OPTIONS}
                    />
                  </div>
                  {savingTemplate === p.id && <Spinner size="small" />}
                </InlineStack>
              </div>
            )}
          </IndexTable.Cell>

          <IndexTable.Cell>
            <div onClick={(e) => e.stopPropagation()}>
              <ActiveToggleBadge
                isActive={p.isActive}
                loading={toggling === p.id}
                onToggle={() => onToggleActive(p)}
                resourceLabel="producto"
              />
            </div>
          </IndexTable.Cell>

          <IndexTable.Cell>
            <div onClick={(e) => e.stopPropagation()}>
              <InlineStack gap="200" blockAlign="center">
                <Button
                  variant="plain"
                  tone="critical"
                  size="slim"
                  icon={DeleteIcon}
                  accessibilityLabel={`Eliminar ${p.displayName}`}
                  onClick={() => onDelete(p)}
                />
              </InlineStack>
            </div>
          </IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );
}
