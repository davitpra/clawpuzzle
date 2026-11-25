"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BUNDLE_QUANTITIES } from "@/entities/product/lib/bundle";
import type { GeneratePayload } from "@/hooks/useGenerateImage";

/**
 * "Pedido en armado" de 2 o 3 rompecabezas: una pieza por rompecabezas, cada
 * una con su estilo, su tema (Perro | Gato), su mascota y su generación. Al
 * pagar va una línea de 1 por pieza (`_generation_id`) y Shopify aplica el
 * descuento por cantidad.
 *
 * El flujo se deriva de las piezas (`nextBundleStep`): estilo y foto del 1,
 * estilo y foto del 2… y al final la galería con el pago. Cada generación
 * arranca al enviar su foto y sigue por detrás mientras el cliente arma el
 * siguiente.
 *
 * No usa `CartContext`: aquel junta artículos de la misma variante y estilo y
 * se sincroniza con `/cart` del backend, y dos retratos distintos del mismo
 * estilo se mezclarían.
 *
 * Vive en `localStorage` para sobrevivir a una recarga, a `/credits` y al popup
 * de Google: la galería retoma el seguimiento de lo que se estaba generando.
 */
export interface BundlePiece {
  /** null mientras no se elige. */
  styleId: string | null;
  styleName: string | null;
  /** Imagen del estilo para el tema de la pieza: se ve mientras se genera. */
  styleImg: string | null;
  /** Variante (tema Perro | Gato) que se vende para esta pieza. */
  variantId: string;
  petName: string | null;
  /** null mientras falta la foto. */
  generationId: string | null;
  /** Lo que se envió a generar: reintentar o cambiar de estilo sin resubir. */
  payload: GeneratePayload | null;
  /** El retrato listo; null mientras se genera o si falló. */
  imageUrl: string | null;
}

export interface BundleOrder {
  pieces: BundlePiece[];
  updatedAt: number;
}

export type BundleStep =
  | { kind: "style"; index: number }
  | { kind: "photo"; index: number }
  | { kind: "review" };

const STORAGE_KEY = "clawpuzzle_bundle_order";
/** Un pedido abandonado no reaparece semanas después. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_PIECES = BUNDLE_QUANTITIES[BUNDLE_QUANTITIES.length - 1];

// ---- Funciones puras (testeadas en bundleOrder.test.ts) ------------------

export function emptyPiece(variantId: string): BundlePiece {
  return {
    styleId: null,
    styleName: null,
    styleImg: null,
    variantId,
    petName: null,
    generationId: null,
    payload: null,
    imageUrl: null,
  };
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function parsePiece(value: unknown): BundlePiece | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.variantId !== "string") return null;
  const generationId = str(v.generationId);
  const payload = v.payload as GeneratePayload | null | undefined;
  return {
    styleId: str(v.styleId),
    styleName: str(v.styleName),
    styleImg: str(v.styleImg),
    variantId: v.variantId,
    petName: str(v.petName),
    generationId,
    payload:
      generationId && payload && typeof payload.petId === "string"
        ? payload
        : null,
    imageUrl: generationId ? str(v.imageUrl) : null,
  };
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
    if (!Array.isArray(data.pieces)) return null;
    const pieces = data.pieces
      .map(parsePiece)
      .filter((p): p is BundlePiece => p !== null)
      .slice(0, MAX_PIECES);
    if (pieces.length === 0) return null;
    return { pieces, updatedAt: data.updatedAt };
  } catch {
    return null;
  }
}

/**
 * Pedido de `quantity` piezas. `first` es el retrato que ya existe cuando se
 * sube de 1 a 2 o 3 desde la vista previa.
 */
export function createBundleOrder(
  quantity: number,
  variantId: string,
  now: number,
  first?: BundlePiece,
): BundleOrder {
  const count = Math.min(Math.max(quantity, 1), MAX_PIECES);
  const pieces = Array.from({ length: count }, (_, i) =>
    i === 0 && first ? first : emptyPiece(first?.variantId ?? variantId),
  );
  return { pieces, updatedAt: now };
}

/**
 * El paso que toca: la primera pieza sin generación, por su estilo si aún no
 * lo tiene y si no por su foto. Con todas enviadas, la galería.
 */
export function nextBundleStep(order: BundleOrder): BundleStep {
  const index = order.pieces.findIndex((p) => !p.generationId);
  if (index === -1) return { kind: "review" };
  return { kind: order.pieces[index].styleId ? "photo" : "style", index };
}

/** Un pedido sin ningún estilo elegido todavía no es progreso que conservar. */
export function hasProgress(order: BundleOrder | null): boolean {
  return !!order?.pieces.some((p) => p.styleId);
}

export function updatePiece(
  order: BundleOrder,
  index: number,
  patch: Partial<BundlePiece>,
  now: number,
): BundleOrder {
  if (!order.pieces[index]) return order;
  return {
    pieces: order.pieces.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    updatedAt: now,
  };
}

/** Agrega una pieza vacía, con el tema de la última. Tope: 3. */
export function addPiece(order: BundleOrder, now: number): BundleOrder {
  if (order.pieces.length >= MAX_PIECES) return order;
  const last = order.pieces[order.pieces.length - 1];
  return {
    pieces: [...order.pieces, emptyPiece(last.variantId)],
    updatedAt: now,
  };
}

/** Quita una pieza; la última que queda no se quita. */
export function removePiece(
  order: BundleOrder,
  index: number,
  now: number,
): BundleOrder {
  if (order.pieces.length <= 1 || !order.pieces[index]) return order;
  return {
    pieces: order.pieces.filter((_, i) => i !== index),
    updatedAt: now,
  };
}

/**
 * Quita hasta `count` piezas que aún no tienen generación, empezando por el
 * final: "Hacer solo 2" cuando no alcanzan las vistas previas. Siempre queda
 * al menos una.
 */
export function dropPendingPieces(
  order: BundleOrder,
  count: number,
  now: number,
): BundleOrder {
  const pieces = [...order.pieces];
  let left = count;
  for (let i = pieces.length - 1; i >= 0 && left > 0 && pieces.length > 1; i--) {
    if (!pieces[i].generationId) {
      pieces.splice(i, 1);
      left--;
    }
  }
  return { pieces, updatedAt: now };
}

// ---- Store sobre localStorage ---------------------------------------------

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedOrder: BundleOrder | null = null;
// Modo privado o almacenamiento bloqueado: el pedido vive solo en memoria.
let memoryRaw: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
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
  const raw = order ? JSON.stringify(order) : null;
  try {
    if (raw) window.localStorage.setItem(STORAGE_KEY, raw);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    memoryRaw = raw;
  }
  listeners.forEach((l) => l());
}

/** Aplica `fn` al pedido guardado; sin pedido no hace nada. */
function change(fn: (order: BundleOrder, now: number) => BundleOrder) {
  const current = getSnapshot();
  if (current) write(fn(current, Date.now()));
}

/** Pedido en armado compartido por `/create` y sus pasos. */
export function useBundleOrder() {
  const order = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Arranca un pedido de `quantity` piezas, salvo que ya haya uno con progreso
   * (vuelta desde `/credits`, recarga): ese se retoma tal cual. Lee el
   * almacenamiento, no el render: en la hidratación `order` aún es null.
   */
  const ensure = useCallback((quantity: number, variantId: string) => {
    const current = getSnapshot();
    if (hasProgress(current)) return;
    if (current?.pieces.length === quantity) return;
    write(createBundleOrder(quantity, variantId, Date.now()));
  }, []);

  /** Sube de 1 a `quantity` desde la vista previa, con su retrato como pieza 1. */
  const startWith = useCallback((quantity: number, first: BundlePiece) => {
    write(createBundleOrder(quantity, first.variantId, Date.now(), first));
  }, []);

  const update = useCallback((index: number, patch: Partial<BundlePiece>) => {
    change((o, now) => updatePiece(o, index, patch, now));
  }, []);

  const add = useCallback(() => change(addPiece), []);

  const remove = useCallback((index: number) => {
    change((o, now) => removePiece(o, index, now));
  }, []);

  const dropPending = useCallback((count: number) => {
    change((o, now) => dropPendingPieces(o, count, now));
  }, []);

  const clear = useCallback(() => write(null), []);

  return { order, ensure, startWith, update, add, remove, dropPending, clear };
}
