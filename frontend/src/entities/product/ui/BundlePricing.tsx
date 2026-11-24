import {
  BUNDLE_QUANTITIES,
  bundlePrice,
  type BundleQuantity,
} from "@/entities/product/lib/bundle";

interface BundlePricingProps {
  /** Precio de un rompecabezas sin bundle. */
  unitPrice: number;
  value: BundleQuantity;
  onChange: (quantity: BundleQuantity) => void;
  /** Formatea un monto con el estilo de precio de la pantalla que lo usa. */
  formatMoney: (amount: number) => string;
  className?: string;
}

/**
 * Sección "Más mascotas, mejor precio" de la ficha (`ProductInfo`). Informa los
 * tramos del bundle y deja preseleccionar la cantidad, que viaja a `/create`
 * con el CTA. La decisión final se toma tras ver la vista previa.
 */
export function BundlePricing({
  unitPrice,
  value,
  onChange,
  formatMoney,
  className = "",
}: BundlePricingProps) {
  return (
    <section className={`flex w-full flex-col gap-3 text-left ${className}`}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-black text-text-main">
          Más mascotas, mejor precio
        </h2>
        <p className="text-sm text-text-muted">
          Cada rompecabezas con su propio retrato. Eliges cuántos quieres después
          de ver tu vista previa.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Cuántos rompecabezas"
        className="flex flex-col gap-1 rounded-2xl border border-text-main/10 p-2"
      >
        {BUNDLE_QUANTITIES.map((quantity) => {
          const price = bundlePrice(unitPrice, quantity);
          const selected = quantity === value;
          return (
            <button
              key={quantity}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(quantity)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                selected ? "bg-cream" : "hover:bg-cream/60"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-text-main" : "border-text-main/30"
                }`}
              >
                {selected && <span className="size-2.5 rounded-full bg-text-main" />}
              </span>
              <span className="flex-1 text-base text-text-main">
                {quantity} rompecabezas
              </span>
              {quantity > 1 && (
                <span className="text-sm text-text-muted">
                  {formatMoney(price.unitPrice)} c/u
                </span>
              )}
              <span className="font-display text-lg font-black text-text-main">
                {formatMoney(price.total)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
