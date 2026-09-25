"use client";

import {
  Badge,
  BlockStack,
  Button,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { AdminProduct, AdminStyle } from "@/entities/admin/api";
import { SpecialRoleCard } from "./SpecialRoleCard";

interface LaunchProductCardProps {
  products: AdminProduct[];
  selected: AdminProduct | null;
  /** Estilos activos: los que el visitante puede elegir con este producto. */
  styles: AdminStyle[];
  imageMap: Record<string, string>;
  saving: boolean;
  onChange: (productId: string) => void;
  onRowClick: (id: string) => void;
}

/**
 * El producto único que vende la landing de lanzamiento. No lleva estilo
 * propio: el visitante elige cualquiera de los estilos activos y ese estilo
 * viaja en la generación. Debajo se listan esos estilos para que se vea qué
 * ofrece hoy el producto; se activan o desactivan desde `/admin/styles`.
 */
export function LaunchProductCard({
  styles,
  ...roleProps
}: LaunchProductCardProps) {
  return (
    <SpecialRoleCard
      {...roleProps}
      title="Producto de lanzamiento"
      label="Producto único de la landing"
      helpText="Solo puede haber uno. Admite todos los estilos activos: el cliente elige el estilo al crear su arte."
    >
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingXs">
            Estilos disponibles ({styles.length})
          </Text>
          <Button variant="plain" url="/admin/styles">
            Gestionar estilos
          </Button>
        </InlineStack>
        {styles.length === 0 ? (
          <Text as="p" tone="caution">
            No hay estilos activos: el producto no se puede usar hasta activar
            al menos uno.
          </Text>
        ) : (
          <InlineStack gap="200" wrap>
            {styles.map((style) => (
              <Badge key={style.id} tone="info">
                {style.displayName}
              </Badge>
            ))}
          </InlineStack>
        )}
      </BlockStack>
    </SpecialRoleCard>
  );
}
