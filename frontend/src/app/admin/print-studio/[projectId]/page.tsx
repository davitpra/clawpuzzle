"use client";

import { useParams } from "next/navigation";
import PrintStudioWorkspace from "./_components/PrintStudioWorkspace";

export default function PrintStudioPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return <PrintStudioWorkspace projectId={projectId} />;
}
