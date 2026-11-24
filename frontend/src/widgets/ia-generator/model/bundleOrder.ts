"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  BUNDLE_QUANTITIES,
  parseBundleQuantity,
  type BundleQuantity,
} from "@/entities/product/lib/bundle";

/**
 * "Pedido en armado" del bundle por cantidad: los retratos que el cliente ya
 * apartó para su pedido mientras crea los siguientes. Cada uno es un
 * rompecabezas con su propio arte (`_generation_id`), así que al pagar va una
 * línea de 1 por retrato y Shopify aplica el descuento por cantidad.
 *
 * No usa `CartContext`: aquel junta artículos de la misma variante y estilo y
 * se sincroniza con `/cart` del backend, y dos retratos distintos del mismo
 * estilo se mezclarían.
 *
 * Vive en `localStorage` para sobrevivir al viaje estilo → foto → generar y al
 * popup de Google. El retrato que se está mirando **no** está aquí: entra al
 * apartarlo ("Crear el retrato 2") o va directo al pago.
 */
export interface BundleSlot {
  generationId: string;
  imageUrl: string;
  styleName: string | null;
  /** Variante (tema Perro | Gato) con la que se pidió este retrato. */
  variantId: string;
  petName: string | null;
}

export interface BundleOrder {
  quantity: BundleQuantity;
  slots: BundleSlot[];
  updatedAt: number;
}

const STORAGE_KEY = "clawpuzzle_bundle_order";
/** Un pedido abandonado no reaparece semanas después. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_QUANTITY = BUNDLE_QUANTITIES[BUNDLE_QUANTITIES.length - 1];

// ---- Funciones puras (testeadas en bundleOrder.test.ts) ------------------

function isSlot(value: unknown): value is BundleSlot {
  const v = value as Partial<BundleSlot> | null;
  return (
    !!v &&
    typeof v.generationId === "string" &&
    typeof v.imageUrl === "string" &&
    typeof v.variantId === "string"
  );
}

/** Lee el pedido guardado; `null` si no hay, está corrupto o caducó. */
export function parseBundleOrder(
  raw: string | null,
  now: number,
): BundleOrder | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<BundleOrder>;
    if (typeof data.updatedAt !== "number") return null;
    if (now - data.updatedAt > MAX_AGE_MS) return null;
    const slots = Array.isArray(data.slots)
      ? data.slots.filter(isSlot).slice(0, MAX_QUANTITY - 1)
      : [];
    const quantity = parseBundleQuantity(String(data.quantity));
    return {
      quantity: Math.max(quantity, slots.length + 1) as BundleQuantity,
      slots,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

/** Aparta un retrato; si ya estaba, no lo duplica. */
export function addSlot(
  order: BundleOrder | null,
  slot: BundleSlot,
  quantity: BundleQuantity,
  now: number,
): BundleOrder {
  const slots = (order?.slots ?? []).filter(
    (s) => s.generationId !== slot.generationId,
  );
  const next = [...slots, slot].slice(0, MAX_QUANTITY - 1);
  return {
    quantity: Math.max(quantity, next.length + 1) as BundleQuantity,
    slots: next,
    updatedAt: now,
  };
}

/** Quita un retrato apartado. La cantidad elegida no cambia. */
export function removeSlot(
  order: BundleOrder,
  generationId: string,
  now: number,
): BundleOrder {
  return {
    ...order,
    slots: order.slots.filter((s) => s.generationId !== generationId),
    updatedAt: now,
  };
}

/**
 * Cambia la cantidad. Nunca por debajo de los retratos apartados más el que se
 * está mirando: para pedir menos hay que quitar uno antes.
 */
export function withQuantity(
  order: BundleOrder | null,
  quantity: BundleQuantity,
  now: number,
): BundleOrder {
  const slots = order?.slots ?? [];
  return {
    quantity: Math.max(quantity, slots.length + 1) as BundleQuantity,
    slots,
    updatedAt: now,
  };
}

// ---- Store sobre localStorage ---------------------------------------------

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedOrder: BundleOrder | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Modo privado o almacenamiento bloqueado: se trabaja sin pedido guardado.
    return null;
  }
}

// `useSyncExternalStore` exige la misma referencia mientras no cambie el valor:
// se re-parsea solo si cambió el texto guardado.
function getSnapshot(): BundleOrder | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedOrder = parseBundleOrder(raw, Date.now());
  }
  return cachedOrder;
}

function getServerSnapshot(): BundleOrder | null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Otra pestaña con el mismo pedido.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(order: BundleOrder | null) {
  try {
    if (order) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento el pedido no persiste, pero el pago sigue funcionando
    // con el retrato en pantalla.
  }
  listeners.forEach((l) => l());
}

/**
 * Pedido en armado compartido entre `/create` y la pantalla de la vista previa.
 * `initialQuantity` es la cantidad preseleccionada en la landing (`qty`), que
 * solo cuenta mientras no haya pedido guardado.
 */
export function useBundleOrder(initialQuantity: BundleQuantity = 1) {
  const order = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setQuantity = useCallback((quantity: BundleQuantity) => {
    write(withQuantity(getSnapshot(), quantity, Date.now()));
  }, []);

  const keep = useCallback(
    (slot: BundleSlot, quantity: BundleQuantity) => {
      write(addSlot(getSnapshot(), slot, quantity, Date.now()));
    },
    [],
  );

  const remove = useCallback((generationId: string) => {
    const current = getSnapshot();
    if (current) write(removeSlot(current, generationId, Date.now()));
  }, []);

  const clear = useCallback(() => write(null), []);

  return {
    quantity: order?.quantity ?? initialQuantity,
    slots: order?.slots ?? [],
    setQuantity,
    keep,
    remove,
    clear,
  };
}
