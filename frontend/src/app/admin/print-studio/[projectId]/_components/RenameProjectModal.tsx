"use client";

import { useState } from "react";
import { Banner, BlockStack, Modal, TextField } from "@shopify/polaris";
import { adminApi, PrintProject } from "@/entities/admin/api";

export function RenameProjectModal({
  project,
  onRenamed,
  onClose,
}: {
  project: PrintProject;
  onRenamed: (project: PrintProject) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      onRenamed(await adminApi.printProjects.rename(project.id, title));
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Renombrar proyecto"
      primaryAction={{
        content: "Guardar",
        loading: saving,
        disabled: !title.trim(),
        onAction: save,
      }}
      secondaryActions={[
        { content: "Cancelar", disabled: saving, onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {err && <Banner tone="critical">{err}</Banner>}
          <TextField
            label="Nombre"
            autoComplete="off"
            value={title}
            onChange={setTitle}
            maxLength={200}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
