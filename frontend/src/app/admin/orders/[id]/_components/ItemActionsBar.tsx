"use client";

import { RefObject } from "react";
import { Button, InlineStack } from "@shopify/polaris";
import { ImageIcon, DeleteIcon } from "@shopify/polaris-icons";

type ItemActionsBarProps = {
  hasPrintImage: boolean;
  uploading: boolean;
  removing: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveClick: () => void;
};

// Barra de acciones del item: subir/reemplazar o borrar la imagen de impresión.
export function ItemActionsBar({
  hasPrintImage,
  uploading,
  removing,
  fileInputRef,
  onUploadClick,
  onUploadChange,
  onRemoveClick,
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
        {hasPrintImage ? "Reemplazar imagen final" : "Subir imagen final"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        icon={DeleteIcon}
        loading={removing}
        disabled={!hasPrintImage}
        onClick={onRemoveClick}
      >
        Borrar
      </Button>
    </InlineStack>
  );
}
