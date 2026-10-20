"use client";

import { RefObject } from "react";
import { Button, InlineStack } from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

type ItemActionsBarProps = {
  hasPrintImage: boolean;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

// Barra de acciones del item: subir/reemplazar la imagen de impresión.
export function ItemActionsBar({
  hasPrintImage,
  uploading,
  fileInputRef,
  onUploadClick,
  onUploadChange,
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
    </InlineStack>
  );
}
