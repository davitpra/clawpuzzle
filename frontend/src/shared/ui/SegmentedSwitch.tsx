"use client";

import type { ChipOption } from "./OptionChips";

interface SegmentedSwitchProps {
  /** Nombre del grupo de radios; debe ser único dentro de la página. */
  name: string;
  label: string;
  value: string;
  options: ChipOption[];
  onChange: (value: string) => void;
  /** Oculta la fila de título por debajo de `lg`, igual que `OptionChips`. */
  hideHeaderOnMobile?: boolean;
}

/**
 * Switch segmentado: una pista en píldora con una pastilla que se desliza
 * hasta la opción elegida. Pensado para 2–3 opciones cortas (p. ej. Perro |
 * Gato). Igual que `OptionChips`, los radios van ocultos pero reciben el foco
 * y las flechas del teclado.
 */
export default function SegmentedSwitch({
  name,
  label,
  value,
  options,
  onChange,
  hideHeaderOnMobile = false,
}: SegmentedSwitchProps) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = options[selectedIndex]?.label;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`${hideHeaderOnMobile ? "hidden lg:flex" : "flex"} items-baseline justify-between gap-4`}
      >
        <span className="text-sm font-black uppercase tracking-widest text-text-muted">
          {label}
        </span>
        {selectedLabel && (
          <span className="font-body text-sm font-bold text-text-main">
            {selectedLabel}
          </span>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className="relative grid rounded-full border border-[#E0DED9] bg-cream p-1.5"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {selectedIndex >= 0 && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-1.5 rounded-full bg-primary shadow-md transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `calc((100% - 0.75rem) / ${options.length})`,
              transform: `translateX(${selectedIndex * 100}%)`,
            }}
          />
        )}

        {options.map((option) => (
          <label key={option.value} className="relative block">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              aria-label={`${label}: ${option.label}`}
              className="peer sr-only"
            />
            <span
              className={
                "flex cursor-pointer items-center justify-center rounded-full px-4 py-3 " +
                "text-center font-body text-base leading-tight text-text-main transition-colors duration-300 " +
                "peer-checked:font-bold peer-checked:text-white " +
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 " +
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-40"
              }
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
