"use client";

import { RefObject } from "react";
import { Button, InlineStack } from "@shopify/polaris";
import { ImageIcon, MagicIcon } from "@shopify/polaris-icons";

type ItemActionsBarProps = {
  hasPrintImage: boolean;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pbnStudioUrl: string;
};

// Barra de acciones del item: subir/reemplazar la imagen de impresión y crear
// un PBN. Ambos estudios se abren como páginas independientes.
export function ItemActionsBar({
  hasPrintImage,
  uploading,
  fileInputRef,
  onUploadClick,
  onUploadChange,
  pbnStudioUrl,
}: ItemActionsBarProps) {
  return (
    <InlineStack gap="200" blockAlign="center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onUploadChange}
      />
      <Button
        size="micro"
        icon={ImageIcon}
        loading={uploading}
        onClick={onUploadClick}
      >
        {hasPrintImage ? "Reemplazar" : "Subir imagen"}
      </Button>
      <Button size="micro" icon={MagicIcon} url={pbnStudioUrl}>
        Convertir a PBN
      </Button>
    </InlineStack>
  );
}
