"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Banner,
  Box,
  Card,
  InlineStack,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { adminApi } from "@/entities/admin/api";

// El estudio vive en /admin/print-studio/[projectId]. Esta ruta abre (o crea)
// el proyecto de la línea y redirige; así siguen valiendo los enlaces viejos y
// el botón "Preparar para impresión" del pedido.
export default function OrderItemPrintStudioRedirect() {
  const { id: orderId, itemId } = useParams<{ id: string; itemId: string }>();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminApi.orders
      .openPrintProject(orderId, itemId)
      .then(
        (project) =>
          active && router.replace(`/admin/print-studio/${project.id}`),
      )
      .catch((e) => active && setErr((e as Error).message));
    return () => {
      active = false;
    };
  }, [orderId, itemId, router]);

  return (
    <Page
      backAction={{ url: `/admin/orders/${orderId}`, content: "Pedido" }}
      title="Estudio de impresión"
    >
      {err ? (
        <Banner tone="critical">{err}</Banner>
      ) : (
        <Card>
          <Box padding="600">
            <InlineStack align="center" gap="200">
              <Spinner size="small" />
              <Text as="span" tone="subdued">
                Abriendo proyecto…
              </Text>
            </InlineStack>
          </Box>
        </Card>
      )}
    </Page>
  );
}
