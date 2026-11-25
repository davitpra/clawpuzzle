"use client";

interface AddPetButtonProps {
  /** Lo que cuesta agregar un rompecabezas más, ya formateado. */
  cost: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Invita a sumar otro rompecabezas al pedido. Usa el verde de los ahorros
 * ("Envío gratis", "Más elegido") para leerse como oferta, sin competir con
 * el botón principal de pedir.
 */
export function AddPetButton({ cost, onClick, disabled = false }: AddPetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 text-left transition-all hover:border-green-400 hover:bg-green-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          favorite
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-bold text-slate-dark">
          Agrega otra mascota
        </span>
        <span className="text-sm text-green-800">
          por solo <strong className="font-bold">{cost}</strong> más
        </span>
      </span>
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-[22px] text-green-700 transition-transform group-hover:translate-x-0.5"
      >
        arrow_forward
      </span>
    </button>
  );
}
