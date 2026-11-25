"use client";

import {
  BUNDLE_QUANTITIES,
  bundlePrice,
  nextBundleCost,
  type BundleQuantity,
} from "@/entities/product/lib/bundle";
import { AddPetButton } from "./AddPetButton";

/** Etiqueta de cada tramo, como en la sección de la landing. */
const BADGES: Partial<Record<BundleQuantity, string>> = {
  2: "Más elegido",
  3: "Mejor precio",
};

interface BundleOrderPanelProps {
  quantity: BundleQuantity;
  onQuantityChange: (quantity: BundleQuantity) => void;
  unitPrice: number;
  formatMoney: (amount: number) => string;
  /** El retrato que está en pantalla: es el rompecabezas 1. */
  currentImage: string | null;
  /**
   * "Agrega otra mascota": arranca ya el pedido con un rompecabezas más (como
   * elegir esa cantidad y pulsar "Crear el retrato N").
   */
  onAddPet: (quantity: BundleQuantity) => void;
  /** Mientras se abre Google o el siguiente paso. */
  addPetDisabled?: boolean;
}

/**
 * "¿Cuántos quieres?" de la vista previa de un solo retrato: los tramos del
 * bundle y, con más de uno, un espacio por rompecabezas (este y los que
 * faltan). Los siguientes se crean en el flujo por rompecabezas.
 */
export function BundleOrderPanel({
  quantity,
  onQuantityChange,
  unitPrice,
  formatMoney,
  currentImage,
  onAddPet,
  addPetDisabled = false,
}: BundleOrderPanelProps) {
  const next = BUNDLE_QUANTITIES.find((q) => q === quantity + 1);
  const nextCost = nextBundleCost(unitPrice, quantity);

  return (
    <section className="flex flex-col gap-3">
      {/* Primero el atajo: la mayoría que quiere otro va directo al estilo. */}
      {next && (
        <AddPetButton
          cost={formatMoney(nextCost)}
          onClick={() => onAddPet(next)}
          disabled={addPetDisabled}
        />
      )}

      <div className="mt-2 flex flex-col gap-1">
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
          const badge = BADGES[q];
          return (
            <button
              key={q}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onQuantityChange(q)}
              className={`flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 text-left transition-all ${
                selected
                  ? "border-slate-dark"
                  : "border-[#E0DED9] hover:border-slate-dark/40"
              }`}
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

      {quantity > 1 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="Tus retratos">
          <li className="flex flex-col gap-1">
            <div className="relative aspect-2/3 overflow-hidden bg-[#EFEAE1] ring-2 ring-slate-dark">
              {currentImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt="Retrato 1"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
            <span className="truncate text-xs font-bold text-slate-dark">
              Este retrato
            </span>
          </li>

          {Array.from({ length: quantity - 1 }, (_, i) => (
            <li key={`empty-${i + 2}`} className="flex flex-col gap-1">
              <div className="flex aspect-2/3 flex-col items-center justify-center gap-1 border-2 border-dashed border-[#E0DED9] text-text-muted">
                <span className="material-symbols-outlined text-[22px]">add</span>
              </div>
              <span className="truncate text-xs text-text-muted">Retrato {i + 2}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
