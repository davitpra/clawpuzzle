"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Spinner,
  Text,
  InlineStack,
  Box,
  Filters,
  Pagination,
  EmptyState,
  Thumbnail,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import {
  adminApi,
  Paginated,
  PrintProjectListItem,
} from "@/entities/admin/api";
import { fmtShortDate } from "@/entities/admin/lib/order-format";

const SEARCH_DEBOUNCE_MS = 300;

export default function PrintStudioListPage() {
  const router = useRouter();
  const [projects, setProjects] =
    useState<Paginated<PrintProjectListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // La búsqueda espera a que el admin deje de escribir.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(
        await adminApi.printProjects.list({ page, q: query || undefined }),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    try {
      const project = await adminApi.printProjects.create();
      router.push(`/admin/print-studio/${project.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <Page
      title="Estudio de impresión"
      subtitle="Imágenes preparadas para imprimir, con o sin pedido"
      primaryAction={{
        content: "Nuevo proyecto",
        loading: creating,
        onAction: handleCreate,
      }}
    >
      <Card padding="0">
        <Box
          paddingInline="400"
          paddingBlock="300"
          borderBlockEndWidth="025"
          borderColor="border"
        >
          <Filters
            queryValue={q}
            filters={[]}
            appliedFilters={[]}
            onQueryChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            onQueryClear={() => {
              setQ("");
              setPage(1);
            }}
            onClearAll={() => {
              setQ("");
              setPage(1);
            }}
            queryPlaceholder="Buscar por nombre, # pedido o cliente…"
          />
        </Box>

        {loading && !projects ? (
          <Box padding="600">
            <InlineStack align="center" gap="300">
              <Spinner size="small" />
              <Text as="span" tone="subdued">
                Cargando proyectos…
              </Text>
            </InlineStack>
          </Box>
        ) : !projects?.data.length ? (
          <EmptyState
            heading={
              query ? "Ningún proyecto coincide" : "Aún no hay proyectos"
            }
            action={
              query
                ? undefined
                : { content: "Nuevo proyecto", onAction: handleCreate }
            }
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" tone="subdued">
              Crea un proyecto para preparar una imagen o ábrelo desde la línea
              de un pedido con «Preparar para impresión».
            </Text>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "proyecto", plural: "proyectos" }}
            itemCount={projects.data.length}
            headings={[
              { title: "" },
              { title: "Proyecto" },
              { title: "Pedido" },
              { title: "Actualizado" },
            ]}
            selectable={false}
            loading={loading}
          >
            {projects.data.map((project, index) => (
              <IndexTable.Row
                id={project.id}
                key={project.id}
                position={index}
                onClick={() => router.push(`/admin/print-studio/${project.id}`)}
              >
                <IndexTable.Cell>
                  <Thumbnail
                    source={project.thumbnailUrl ?? ImageIcon}
                    alt={project.title}
                    size="small"
                  />
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="semibold" as="span">
                    {project.title}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {project.orderItem ? (
                    <Text as="span" variant="bodySm">
                      {project.orderItem.order.orderNumber}
                      {project.orderItem.order.customerName &&
                        ` · ${project.orderItem.order.customerName}`}
                    </Text>
                  ) : (
                    <Badge>Sin pedido</Badge>
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" tone="subdued">
                    {fmtShortDate(project.updatedAt)}
                  </Text>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}

        {projects && projects.meta.totalPages > 1 && (
          <Box padding="400" borderBlockStartWidth="025" borderColor="border">
            <InlineStack align="space-between">
              <Text as="span" tone="subdued" variant="bodySm">
                {projects.meta.total} proyecto(s) · Página {projects.meta.page}{" "}
                de {projects.meta.totalPages}
              </Text>
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < projects.meta.totalPages}
                onPrevious={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            </InlineStack>
          </Box>
        )}
      </Card>
    </Page>
  );
}
