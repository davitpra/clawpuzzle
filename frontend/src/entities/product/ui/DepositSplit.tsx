import { splitDeposit } from "@/entities/product/lib/deposit";

interface DepositSplitProps {
  /** Precio total del rompecabezas. */
  price: number;
  /** Formatea un monto con el estilo de precio de la pantalla que lo usa. */
  formatMoney: (amount: number) => string;
  className?: string;
}

/**
 * Sección "Cómo pagas" de la ficha (`ProductInfo`): el anticipo y el saldo en dos
 * tarjetas, lo que se paga hoy y lo que se paga al recibir.
 */
export function DepositSplit({
  price,
  formatMoney,
  className = "",
}: DepositSplitProps) {
  const { deposit, balance } = splitDeposit(price);

  return (
    <section className={`flex w-full flex-col gap-3 text-left ${className}`}>
      <h2 className="font-display text-xl font-black text-text-main">
        Cómo pagas
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-text-main/10 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-xl bg-cream px-4 py-3">
            <span className="text-xs text-text-muted">Hoy, para empezar</span>
            <span className="font-display text-2xl lg:text-3xl font-black text-text-main">
              {formatMoney(deposit)}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-cream px-4 py-3">
            <span className="text-xs text-text-muted">Al recibir</span>
            <span className="font-display text-2xl lg:text-3xl font-black text-text-main">
              {formatMoney(balance)}
            </span>
          </div>
        </div>
        <p className="flex items-start gap-2 text-sm font-medium text-green-700">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            verified_user
          </span>
          Pagas el resto solo cuando tienes el rompecabezas en tus manos.
        </p>
      </div>
    </section>
  );
}
