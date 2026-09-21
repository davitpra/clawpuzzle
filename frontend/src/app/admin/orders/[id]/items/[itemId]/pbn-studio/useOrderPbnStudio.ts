"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  AdminOrderItem,
  AdminPaintByNumbers,
} from "@/entities/admin/api";

export function useOrderPbnStudio(orderId: string, itemId: string) {
  const [item, setItem] = useState<AdminOrderItem | null>(null);
  const [savedPbn, setSavedPbn] = useState<AdminPaintByNumbers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const order = await adminApi.orders.detail(orderId);
      const nextItem = order.items.find((candidate) => candidate.id === itemId);
      if (!nextItem) throw new Error("No se encontró el item del pedido");

      const nextPbn = nextItem.paintByNumbers?.id
        ? await adminApi.pbn.get(nextItem.paintByNumbers.id)
        : null;

      setItem(nextItem);
      setSavedPbn(nextPbn);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el estudio");
    } finally {
      setLoading(false);
    }
  }, [orderId, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { item, savedPbn, loading, error, reload: load };
}
