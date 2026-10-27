"use client";

import { useParams } from "next/navigation";
import PrintStudioWorkspace from "./_components/PrintStudioWorkspace";

export default function PrintStudioPage() {
  const { id: orderId, itemId } = useParams<{
    id: string;
    itemId: string;
  }>();

  return <PrintStudioWorkspace orderId={orderId} itemId={itemId} />;
}
