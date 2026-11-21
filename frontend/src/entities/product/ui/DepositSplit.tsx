import { splitDeposit } from "@/entities/product/lib/deposit";

interface DepositSplitProps {
  /** Precio total del rompecabezas. */
  price: number;
  /** Formatea un monto con el estilo de precio de la pantalla que lo usa. */
  formatMoney: (amount: number) => string;
  className?: string;
}

/**
 * El esquema de pago 70/30 en dos tarjetas: lo que se paga hoy y lo que se paga
 * al recibir. Lo comparten la ficha (`ProductInfo`) y el resultado de la
 * generación (`IAGeneratingStep`), para que las cifras y el texto no se separen.
 */
export function DepositSplit({
  price,
  formatMoney,
  className = "",
}: DepositSplitProps) {
  const { deposit, balance } = splitDeposit(price);

  return (
    <div className={`flex w-full flex-col gap-2 text-left ${className}`}>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl border border-text-main/10 px-4 py-3">
          <span className="text-xs text-text-muted">Hoy, para empezar</span>
          <span className="font-display text-xl font-black text-text-main">
            {formatMoney(deposit)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-text-main/10 px-4 py-3">
          <span className="text-xs text-text-muted">Al recibir, en efectivo</span>
          <span className="font-display text-xl font-black text-text-main">
            {formatMoney(balance)}
          </span>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          verified_user
        </span>
        Pagas el resto solo cuando lo tienes en tus manos
      </p>
    </div>
  );
}
