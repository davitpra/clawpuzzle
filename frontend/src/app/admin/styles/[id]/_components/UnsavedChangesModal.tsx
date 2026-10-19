import { Modal, Text } from "@shopify/polaris";

// Aviso al salir del editor con cambios sin guardar.
export function UnsavedChangesModal({
  open,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onCancel();
      }}
      title="Cambios sin guardar"
      primaryAction={{
        content: "Guardar",
        loading: saving,
        onAction: onSave,
      }}
      secondaryActions={[
        {
          content: "Descartar cambios",
          destructive: true,
          disabled: saving,
          onAction: onDiscard,
        },
      ]}
    >
      <Modal.Section>
        <Text as="p">
          Hay cambios en este estilo que no se han guardado. Si sales ahora se
          perderán.
        </Text>
      </Modal.Section>
    </Modal>
  );
}
