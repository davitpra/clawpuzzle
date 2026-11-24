"use client";

import {
  BUNDLE_QUANTITIES,
  bundlePrice,
  type BundleQuantity,
} from "@/entities/product/lib/bundle";
import type { BundleSlot } from "../model/bundleOrder";

/** Etiqueta de cada tramo, como en la sección de la landing. */
const BADGES: Partial<Record<BundleQuantity, string>> = {
  2: "Más elegido",
  3: "Mejor precio",
};

interface BundleOrderPanelProps {
  quantity: BundleQuantity;
  onQuantityChange: (quantity: BundleQuantity) => void;
  /** Retratos ya apartados más el actual: no se puede pedir menos. */
  minQuantity: number;
  unitPrice: number;
  formatMoney: (amount: number) => string;
  /** Retratos apartados en pasos anteriores (sin el que está en pantalla). */
  keptSlots: BundleSlot[];
  /** El retrato que está en pantalla. */
  currentImage: string | null;
  onRemove: (generationId: string) => void;
}

/**
 * "¿Cuántos quieres?" de la vista previa: los tramos del bundle y, con más de
 * uno, un espacio por rompecabezas (los apartados, este y los que faltan).
 */
export function BundleOrderPanel({
  quantity,
  onQuantityChange,
  minQuantity,
  unitPrice,
  formatMoney,
  keptSlots,
  currentImage,
  onRemove,
}: BundleOrderPanelProps) {
  const next = BUNDLE_QUANTITIES.find((q) => q === quantity + 1);
  // Lo que cuesta el siguiente rompecabezas, exacto: $119,98 − $69,99 = $49,99.
  const nextCost = next
    ? Math.round(
        (bundlePrice(unitPrice, next).total -
          bundlePrice(unitPrice, quantity).total) *
          100,
      ) / 100
    : 0;
  const emptyCount = Math.max(0, quantity - keptSlots.length - 1);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-black text-slate-dark">
          ¿Cuántos quieres?
        </h2>
        <p className="text-sm leading-snug text-text-muted">
          Un regalo para cada uno, o uno por cada mascota de la casa.
        </p>
      </div>

      <div role="radiogroup" aria-label="Cuántos rompecabezas" className="flex flex-col gap-2">
        {BUNDLE_QUANTITIES.map((q) => {
          const price = bundlePrice(unitPrice, q);
          const selected = q === quantity;
          const disabled = q < minQuantity;
          const badge = BADGES[q];
          return (
            <button
              key={q}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled}
              onClick={() => !disabled && onQuantityChange(q)}
              className={`flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 text-left transition-all ${
                selected
                  ? "border-slate-dark"
                  : "border-[#E0DED9] hover:border-slate-dark/40"
              } ${disabled ? "cursor-not-allowed opacity-50 hover:border-[#E0DED9]" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-slate-dark" : "border-slate-dark/30"
                }`}
              >
                {selected && <span className="size-2.5 rounded-full bg-slate-dark" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-bold text-slate-dark">
                    {q} rompecabezas
                  </span>
                  {badge && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-sm text-text-muted">
                  {q === 1 ? "Solo esta mascota" : `${formatMoney(price.unitPrice)} c/u`}
                </span>
              </span>
              <span className="font-display text-xl font-black text-slate-dark">
                {formatMoney(price.total)}
              </span>
            </button>
          );
        })}
      </div>

      {minQuantity > 1 && (
        <p className="text-xs text-text-muted">
          Para pedir menos, quita uno de tus retratos.
        </p>
      )}

      {next && (
        <button
          type="button"
          onClick={() => onQuantityChange(next)}
          className="flex items-center gap-2 rounded-xl bg-[#F5F3EE] px-4 py-3 text-left text-sm text-slate-dark transition-all hover:bg-[#EFEAE1]"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            pets
          </span>
          Agrega otra mascota por solo {formatMoney(nextCost)} más.
        </button>
      )}

      {quantity > 1 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="Tus retratos">
          {keptSlots.map((slot, i) => (
            <li key={slot.generationId} className="flex flex-col gap-1">
              <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-[#EFEAE1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.imageUrl}
                  alt={`Retrato ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemove(slot.generationId)}
                  aria-label={`Quitar el retrato ${i + 1}`}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-white/90 text-slate-dark shadow-sm transition-all hover:bg-white"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <span className="truncate text-xs text-text-muted">
                {slot.styleName ?? `Retrato ${i + 1}`}
              </span>
            </li>
          ))}

          <li className="flex flex-col gap-1">
            <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-[#EFEAE1] ring-2 ring-slate-dark">
              {currentImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt={`Retrato ${keptSlots.length + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
            <span className="truncate text-xs font-bold text-slate-dark">
              Este retrato
            </span>
          </li>

          {Array.from({ length: emptyCount }, (_, i) => {
            const n = keptSlots.length + 2 + i;
            return (
              <li key={`empty-${n}`} className="flex flex-col gap-1">
                <div className="flex aspect-2/3 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#E0DED9] text-text-muted">
                  <span className="material-symbols-outlined text-[22px]">add</span>
                </div>
                <span className="truncate text-xs text-text-muted">Retrato {n}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
