"use client";

import { useParams } from "next/navigation";
import { Page } from "@shopify/polaris";
import PrintStudioWorkspace from "./_components/PrintStudioWorkspace";

export default function PrintStudioPage() {
  const { id: orderId, itemId } = useParams<{
    id: string;
    itemId: string;
  }>();

  return (
    <Page
      backAction={{ url: `/admin/orders/${orderId}`, content: "Pedido" }}
      title="Estudio de impresión"
      subtitle="Imagen generada"
      fullWidth
    >
      <PrintStudioWorkspace orderId={orderId} itemId={itemId} />
    </Page>
  );
}
