import { useEffect, useMemo, useState } from "react";
import {
  adminApi,
  AdminProduct,
  AdminStyle,
  SyncStatus,
} from "@/entities/admin/api";
import {
  resolveTemplate,
} from "./_components/ProductsTable";


/** Espera a que el backend termine la sincronización, que corre en async. */
const SYNC_SETTLE_MS = 1500;

/**
 * Encapsula la carga de datos, el estado y las acciones de la lista de productos
 * del admin. Los cambios de campo se aplican de forma optimista sobre la lista y
 * se revierten recargando del servidor si el guardado falla.
 *
 * Recibe `productTypeMap` (de `useShopifyProductMeta`) porque el template
 * efectivo de un producto puede venir heredado del `productType` de Shopify, y
 * de él depende la partición entre productos y accesorios (ver
 * `resolveTemplate`).
 */
export function useProductsList(productTypeMap: Record<string, string>) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [styles, setStyles] = useState<AdminStyle[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [savingStyle, setSavingStyle] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [savingCreditPack, setSavingCreditPack] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState<AdminProduct | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const loadProducts = () => {
    setLoading(true);
    adminApi.products
      .list()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadSyncStatus = () => {
    adminApi.sync
      .status()
      .then(setSyncStatus)
      .catch(() => {
        // best-effort: la card de sync es informativa
      });
  };

  const loadStyles = () => {
    adminApi.styles
      .list()
      .then((all) => setStyles(all.filter((s) => s.isActive)))
      .catch(() => {
        // best-effort: sin estilos el Select queda en "Sin asignar"
      });
  };

  useEffect(() => {
    loadProducts();
    loadSyncStatus();
    loadStyles();
  }, []);

  /**
   * Aplica un cambio optimista sobre la lista y lo guarda en el backend. Si el
   * guardado falla, publica el error y recarga del servidor para descartar el
   * cambio optimista.
   */
  const runOptimistic = async (
    patch: (prev: AdminProduct[]) => AdminProduct[],
    save: () => Promise<unknown>,
  ) => {
    setProducts(patch);
    try {
      await save();
    } catch (e: unknown) {
      setError((e as Error).message);
      loadProducts();
    }
  };

  /**
   * El rol Credit Pack es excluyente: asignar uno desasigna al anterior.
   * El backend garantiza la unicidad; aquí solo la reflejamos.
   */
  const setExclusiveRole = async (
    field: "isCreditPack",
    productId: string,
    save: (target: string | null) => Promise<void>,
    setSaving: (value: boolean) => void,
  ) => {
    const target = productId || null;
    setSaving(true);
    await runOptimistic(
      (prev) => prev.map((p) => ({ ...p, [field]: p.id === target })),
      () => save(target),
    );
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await adminApi.sync.trigger();
      await new Promise((r) => setTimeout(r, SYNC_SETTLE_MS));
      loadSyncStatus();
      loadProducts();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (p: AdminProduct) => {
    setToggling(p.id);
    try {
      if (p.isActive) {
        await adminApi.products.deactivate(p.id);
      } else {
        await adminApi.products.update(p.id, { isActive: true });
      }
      loadProducts();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingTarget) return;
    setDeleting(true);
    try {
      await adminApi.products.delete(deletingTarget.id);
      setDeletingTarget(null);
      loadProducts();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleTemplateChange = async (productId: string, value: string) => {
    const template = value || null;
    setSavingTemplate(productId);
    await runOptimistic(
      (prev) => prev.map((p) => (p.id === productId ? { ...p, template } : p)),
      () => adminApi.products.update(productId, { template }),
    );
    setSavingTemplate(null);
  };

  const handleStyleChange = async (productId: string, newStyleId: string) => {
    const styleId = newStyleId || null;
    const selected = styleId ? styles.find((s) => s.id === styleId) : undefined;
    const style = selected
      ? {
          id: selected.id,
          name: selected.name,
          displayName: selected.displayName,
          previewUrl: selected.previewUrl,
        }
      : null;

    setSavingStyle(productId);
    await runOptimistic(
      (prev) =>
        prev.map((p) => (p.id === productId ? { ...p, styleId, style } : p)),
      () => adminApi.products.update(productId, { styleId }),
    );
    setSavingStyle(null);
  };

  const handleCreditPackChange = (productId: string) =>
    setExclusiveRole(
      "isCreditPack",
      productId,
      (target) => adminApi.products.setCreditPack(target),
      setSavingCreditPack,
    );

  const creditPackProduct = products.find((p) => p.isCreditPack) ?? null;

  // El producto de créditos tiene su propia card, así que se excluye de la
  // tabla para no duplicarlo. El resto se reparte por `template`: lo que no se
  // puede clasificar va a su propia lista en vez de desaparecer, para que un
  // producto sin template en el admin se note.
  const { puzzleProducts, unclassifiedProducts } = useMemo(() => {
    const specialIds = new Set([creditPackProduct?.id].filter(Boolean));
    const buckets = {
      puzzleProducts: [] as AdminProduct[],
      unclassifiedProducts: [] as AdminProduct[],
    };

    for (const p of products) {
      if (specialIds.has(p.id)) continue;
      if (resolveTemplate(p, productTypeMap) === "Puzzle") {
        buckets.puzzleProducts.push(p);
      } else {
        buckets.unclassifiedProducts.push(p);
      }
    }

    return buckets;
  }, [products, productTypeMap, creditPackProduct?.id]);

  return {
    // data
    products,
    styles,
    syncStatus,
    creditPackProduct,
    puzzleProducts,
    unclassifiedProducts,
    // status
    loading,
    error,
    syncing,
    toggling,
    savingStyle,
    savingTemplate,
    savingCreditPack,
    deletingTarget,
    deleting,
    // setters
    setError,
    setDeletingTarget,
    // actions
    handleSync,
    handleToggle,
    handleDelete,
    handleTemplateChange,
    handleStyleChange,
    handleCreditPackChange,
  };
}
