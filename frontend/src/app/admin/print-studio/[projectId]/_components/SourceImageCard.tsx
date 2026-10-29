"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Modal,
  Text,
} from "@shopify/polaris";
import { adminApi, AdminOrderItem, PrintProject } from "@/entities/admin/api";
import { ItemMediaRow } from "@/app/admin/_components/ItemMediaRow";
import { GenerationPickerModal } from "@/app/admin/_components/GenerationPickerModal";

const SOURCE_LABEL: Record<NonNullable<PrintProject["sourceKind"]>, string> = {
  generation: "Generación con IA",
  upload: "Imagen subida",
};

// Cambio pendiente de confirmar: con un máster guardado, cambiar la imagen de
// origen lo descarta.
type PendingChange =
  { kind: "upload"; file: File } | { kind: "generation"; generationId: string };

// Imagen de origen del proyecto: subirla, tomar la generación de la línea
// vinculada o elegir otra de la galería del cliente.
export function SourceImageCard({
  project,
  sourceUrl,
  item,
  userId,
  alreadyEnhanced,
  disabled,
  onZoom,
  onChange,
}: {
  project: PrintProject;
  sourceUrl: string | null;
  item: AdminOrderItem | null;
  userId: string | null;
  alreadyEnhanced: boolean;
  disabled: boolean;
  onZoom: (zoom: { src: string; title: string }) => void;
  onChange: (project: PrintProject) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<PendingChange["kind"] | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);

  const itemGenerationId = item?.generation?.resultUrl
    ? item.generation.id
    : null;
  const canUseItemGeneration =
    itemGenerationId !== null && itemGenerationId !== project.generation?.id;

  async function apply(change: PendingChange) {
    setSaving(change.kind);
    try {
      const next =
        change.kind === "upload"
          ? await adminApi.printProjects.uploadSource(project.id, change.file)
          : await adminApi.printProjects.setGenerationSource(
              project.id,
              change.generationId,
            );
      setPending(null);
      onChange(next);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  function request(change: PendingChange) {
    if (alreadyEnhanced) setPending(change);
    else void apply(change);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    request({ kind: "upload", file });
  }

  const busy = disabled || saving !== null;

  return (
    <Card>
      {showGallery && userId && (
        <GenerationPickerModal
          userId={userId}
          currentGenerationId={project.generation?.id ?? null}
          title="Elegir de la galería del cliente"
          onPick={async (gen) => {
            setShowGallery(false);
            request({ kind: "generation", generationId: gen.id });
          }}
          onClose={() => setShowGallery(false)}
        />
      )}
      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Cambiar imagen de origen"
          primaryAction={{
            content: "Cambiar imagen",
            destructive: true,
            loading: saving !== null,
            onAction: () => apply(pending),
          }}
          secondaryActions={[
            {
              content: "Cancelar",
              disabled: saving !== null,
              onAction: () => setPending(null),
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              La imagen guardada para impresión y el upscale se descartan y hay
              que volver a prepararla. ¿Continuar?
            </Text>
          </Modal.Section>
        </Modal>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Imagen de origen
        </Text>
        <ItemMediaRow
          image={sourceUrl}
          alt={project.title}
          onZoom={
            sourceUrl
              ? () => onZoom({ src: sourceUrl, title: project.title })
              : undefined
          }
        >
          <Text as="span" tone="subdued" variant="bodySm">
            {project.sourceKind
              ? SOURCE_LABEL[project.sourceKind]
              : "Sube una imagen o elige una generación para empezar."}
          </Text>
        </ItemMediaRow>
        <InlineStack gap="200">
          <Button
            size="slim"
            loading={saving === "upload"}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Subir imagen
          </Button>
          {canUseItemGeneration && itemGenerationId && (
            <Button
              size="slim"
              loading={saving === "generation"}
              disabled={busy}
              onClick={() =>
                request({ kind: "generation", generationId: itemGenerationId })
              }
            >
              Usar generación del pedido
            </Button>
          )}
          {userId && (
            <Button
              size="slim"
              disabled={busy}
              onClick={() => setShowGallery(true)}
            >
              Galería del cliente
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
