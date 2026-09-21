"use client";

import { useParams } from "next/navigation";
import {
  Banner,
  Box,
  Card,
  InlineStack,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import AdminPbnStudio from "@/app/admin/_components/pbn/AdminPbnStudio";
import { useOrderPbnStudio } from "./useOrderPbnStudio";

export default function AdminOrderPbnStudioPage() {
  const { id: orderId, itemId } = useParams<{
    id: string;
    itemId: string;
  }>();
  const { item, savedPbn, loading, error, reload } = useOrderPbnStudio(
    orderId,
    itemId,
  );

  return (
    <Page
      backAction={{ url: `/admin/orders/${orderId}`, content: "Pedido" }}
      title="Convertir a Paint by Numbers"
      subtitle={item?.title ?? "Estudio PBN"}
      fullWidth
    >
      {loading ? (
        <Card>
          <Box padding="600">
            <InlineStack align="center" gap="300">
              <Spinner size="small" />
              <Text as="span" tone="subdued">
                Cargando el estudio PBN…
              </Text>
            </InlineStack>
          </Box>
        </Card>
      ) : error ? (
        <Banner tone="critical">{error}</Banner>
      ) : item ? (
        <AdminPbnStudio
          initialImageSrc={
            item.generation?.resultUrl ??
            item.generation?.thumbnailUrl ??
            undefined
          }
          orderId={orderId}
          itemId={itemId}
          onSaved={reload}
          styleTarget={item.generation?.style ?? undefined}
          savedPbn={
            savedPbn
              ? {
                  config: savedPbn.config,
                  sourceImageUrl: savedPbn.sourceImageUrl,
                  outlineSvgUrl: savedPbn.outlineSvgUrl,
                }
              : undefined
          }
        />
      ) : null}
    </Page>
  );
}
