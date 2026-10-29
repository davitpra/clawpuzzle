"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Modal,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import {
  adminApi,
  AdminOrderDetail,
  AdminOrderListItem,
  PrintProject,
} from "@/entities/admin/api";
import { fmtShortDate } from "@/entities/admin/lib/order-format";
import { orderItemKind } from "@/entities/admin/lib/order-item-kind";
import { ItemMediaRow } from "@/app/admin/_components/ItemMediaRow";

const SEARCH_DEBOUNCE_MS = 300;

// Vincula el proyecto a una línea de pedido: busca el pedido por número o
// cliente y luego elige la línea de arte.
export function LinkOrderModal({
  projectId,
  currentItemId,
  onLinked,
  onClose,
}: {
  projectId: string;
  currentItemId: string | null;
  onLinked: (project: PrintProject) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [searching, setSearching] = useState(true);
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      adminApi.orders
        .list({ q: query.trim() || undefined, limit: 8 })
        .then((res) => active && setOrders(res.data))
        .catch((e) => active && setErr((e as Error).message))
        .finally(() => active && setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function openOrder(id: string) {
    setLoadingOrder(true);
    setErr(null);
    try {
      setOrder(await adminApi.orders.detail(id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingOrder(false);
    }
  }

  async function link(itemId: string) {
    setLinkingId(itemId);
    setErr(null);
    try {
      onLinked(await adminApi.printProjects.link(projectId, itemId));
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLinkingId(null);
    }
  }

  const artItems = order?.items.filter((i) => orderItemKind(i) === "art") ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={order ? `Pedido ${order.orderNumber}` : "Vincular pedido"}
      secondaryActions={[
        ...(order
          ? [{ content: "Volver", onAction: () => setOrder(null) }]
          : []),
        { content: "Cerrar", onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {err && (
            <Banner tone="critical" onDismiss={() => setErr(null)}>
              {err}
            </Banner>
          )}

          {order ? (
            artItems.length === 0 ? (
              <Text as="p" tone="subdued">
                Este pedido no tiene líneas de arte para imprimir.
              </Text>
            ) : (
              artItems.map((item) => {
                const isCurrent = item.id === currentItemId;
                return (
                  <ItemMediaRow
                    key={item.id}
                    image={
                      item.generation?.thumbnailUrl ??
                      item.generation?.resultUrl ??
                      item.imageUrl
                    }
                    alt={item.title}
                  >
                    <InlineStack
                      align="space-between"
                      blockAlign="center"
                      gap="200"
                      wrap={false}
                    >
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                          {item.productRef?.displayName ?? item.title}
                        </Text>
                        {item.variantTitle && (
                          <Text variant="bodySm" tone="subdued" as="span">
                            {item.variantTitle}
                          </Text>
                        )}
                      </BlockStack>
                      <Button
                        size="slim"
                        variant="primary"
                        disabled={isCurrent || linkingId !== null}
                        loading={linkingId === item.id}
                        onClick={() => link(item.id)}
                      >
                        {isCurrent ? "Actual" : "Vincular"}
                      </Button>
                    </InlineStack>
                  </ItemMediaRow>
                );
              })
            )
          ) : (
            <>
              <TextField
                label="Buscar pedido"
                labelHidden
                placeholder="Nº de pedido, cliente o email"
                autoComplete="off"
                value={query}
                onChange={setQuery}
                clearButton
                onClearButtonClick={() => setQuery("")}
              />
              {searching || loadingOrder ? (
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text as="span" tone="subdued">
                    {loadingOrder ? "Abriendo pedido…" : "Buscando…"}
                  </Text>
                </InlineStack>
              ) : orders.length === 0 ? (
                <Text as="p" tone="subdued">
                  Ningún pedido coincide con la búsqueda.
                </Text>
              ) : (
                <BlockStack gap="100">
                  {orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => openOrder(o.id)}
                      style={{
                        border: "1px solid #e3e3e3",
                        borderRadius: 8,
                        padding: "8px 12px",
                        background: "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <InlineStack align="space-between" gap="200">
                        <Text as="span" fontWeight="semibold">
                          {o.orderNumber}
                        </Text>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {fmtShortDate(o.shopifyCreatedAt)}
                        </Text>
                      </InlineStack>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {o.customerName ?? o.customerEmail ?? "Sin cliente"}
                      </Text>
                    </button>
                  ))}
                </BlockStack>
              )}
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
