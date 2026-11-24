import type { OrderPricing } from "../model/orderPricing";

/** Fondo cálido de las superficies secundarias. */
const SOFT_SURFACE = "bg-[#F5F3EE]";

/** Total (con el tachado), anticipo de hoy y saldo al recibir. */
export function OrderTotal({ pricing }: { pricing: OrderPricing }) {
  const { money, savings } = pricing;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-dark/10">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 ${SOFT_SURFACE}`}
      >
        <span className="text-base font-bold text-slate-dark">Total</span>
        <span className="flex items-baseline gap-2">
          {savings > 0 && (
            <span className="text-base font-medium text-text-muted/70 line-through">
              {money(pricing.compareAtTotal)}
            </span>
          )}
          <span className="font-display text-2xl font-black text-slate-dark">
            {money(pricing.total)}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-dark/10 border-t border-slate-dark/10">
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-sm text-text-muted">Hoy, para empezar</span>
          <span className="font-display text-xl font-black text-slate-dark">
            {money(pricing.deposit)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-sm text-text-muted">Al recibir, en efectivo</span>
          <span className="font-display text-xl font-black text-slate-dark">
            {money(pricing.dueOnDelivery)}
          </span>
        </div>
      </div>
      {savings > 0 && (
        <p className="flex items-center gap-2 border-t border-slate-dark/10 px-4 py-2.5 text-sm font-bold text-green-700">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            local_shipping
          </span>
          Envío gratis · ahorras {money(savings)}
        </p>
      )}
    </div>
  );
}

/** Las dos líneas de confianza bajo el botón de pedir. */
export function OrderReassurance({ showBalanceNote }: { showBalanceNote: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {showBalanceNote && (
        <p className="flex items-start gap-2 text-sm font-bold text-green-700">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            verified_user
          </span>
          El resto lo pagas cuando lo tengas en tus manos.
        </p>
      )}
      <p className="flex items-start gap-2 text-sm text-text-muted">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          local_shipping
        </span>
        Lo fabricamos en 3 días y te llega en 3 a 7 días, a todo Ecuador.
      </p>
    </div>
  );
}
