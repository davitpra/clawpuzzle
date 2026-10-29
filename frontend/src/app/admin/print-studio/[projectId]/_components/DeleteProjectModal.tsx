"use client";

import { useState } from "react";
import { Banner, BlockStack, Modal, Text } from "@shopify/polaris";
import { adminApi, PrintProject } from "@/entities/admin/api";

export function DeleteProjectModal({
  project,
  onDeleted,
  onClose,
}: {
  project: PrintProject;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setErr(null);
    try {
      await adminApi.printProjects.remove(project.id);
      onDeleted();
    } catch (e) {
      setErr((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Eliminar proyecto"
      primaryAction={{
        content: "Eliminar",
        destructive: true,
        loading: deleting,
        onAction: remove,
      }}
      secondaryActions={[
        { content: "Cancelar", disabled: deleting, onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {err && <Banner tone="critical">{err}</Banner>}
          <Text as="p">
            Se borran la imagen subida, el upscale y el máster de «
            {project.title}».
            {project.orderItem &&
              " El pedido vinculado conserva su imagen para impresión."}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
