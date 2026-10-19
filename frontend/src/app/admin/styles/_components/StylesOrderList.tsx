"use client";

import { useState } from "react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Icon,
  InlineStack,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DragHandleIcon,
  ImageIcon,
} from "@shopify/polaris-icons";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminStyle } from "@/entities/admin/api";

interface StylesOrderListProps {
  styles: AdminStyle[];
  saving: boolean;
  onSave: (ids: string[]) => void;
  onCancel: () => void;
}

/**
 * Editor del orden en que la landing y el paso de estilo muestran los estilos.
 * Trabaja sobre un borrador local; nada se guarda hasta "Guardar orden".
 */
export function StylesOrderList({
  styles,
  saving,
  onSave,
  onCancel,
}: StylesOrderListProps) {
  const [draft, setDraft] = useState(styles);
  const dirty = draft.some((s, i) => s.id !== styles[i]?.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.length) return;
    setDraft((prev) => arrayMove(prev, from, to));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = draft.findIndex((s) => s.id === active.id);
    const to = draft.findIndex((s) => s.id === over.id);
    move(from, to);
  };

  return (
    <BlockStack gap="0">
      <Box padding="400" borderBlockEndWidth="025" borderColor="border">
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingSm">
              Orden en la landing
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Arrastra los estilos o usa las flechas. Los inactivos no se
              muestran en la landing. El cambio puede tardar hasta 5 minutos en
              verse.
            </Text>
          </BlockStack>
          <ButtonGroup>
            <Button onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!dirty}
              onClick={() => onSave(draft.map((s) => s.id))}
            >
              Guardar orden
            </Button>
          </ButtonGroup>
        </InlineStack>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={draft.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {draft.map((s, index) => (
            <SortableStyleRow
              key={s.id}
              style={s}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === draft.length - 1}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </BlockStack>
  );
}

function SortableStyleRow({
  style,
  position,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  style: AdminStyle;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: style.id });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
    background: "var(--p-color-bg-surface)",
    borderBottom: "1px solid var(--p-color-border-secondary)",
  };

  return (
    <div ref={setNodeRef} style={rowStyle}>
      <Box paddingBlock="200" paddingInline="400">
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <div
            {...attributes}
            {...listeners}
            aria-label={`Arrastrar ${style.displayName}`}
            style={{ cursor: "grab", touchAction: "none", display: "flex" }}
          >
            <Icon source={DragHandleIcon} tone="subdued" />
          </div>
          <Box minWidth="24px">
            <Text as="span" variant="bodySm" tone="subdued">
              {position}
            </Text>
          </Box>
          <Thumbnail
            source={style.previewUrl ?? ImageIcon}
            alt={style.displayName}
            size="small"
          />
          <Box width="100%">
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {style.displayName}
              </Text>
              {!style.isActive && <Badge>Inactivo</Badge>}
            </InlineStack>
          </Box>
          <ButtonGroup variant="segmented">
            <Button
              size="slim"
              icon={ArrowUpIcon}
              disabled={isFirst}
              onClick={onMoveUp}
              accessibilityLabel={`Subir ${style.displayName}`}
            />
            <Button
              size="slim"
              icon={ArrowDownIcon}
              disabled={isLast}
              onClick={onMoveDown}
              accessibilityLabel={`Bajar ${style.displayName}`}
            />
          </ButtonGroup>
        </InlineStack>
      </Box>
    </div>
  );
}
