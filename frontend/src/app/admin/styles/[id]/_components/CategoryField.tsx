"use client";

import { useMemo, useState } from "react";
import { Combobox, Listbox } from "@shopify/polaris";

interface CategoryFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Categorías que ya usan otros estilos; se sugieren para no duplicarlas. */
  existing: string[];
}

/**
 * Texto libre con sugerencias: escribir una categoría nueva la crea, y las que
 * ya existen se ofrecen para no terminar con "Retratos" y "retratos".
 */
export function CategoryField({ value, onChange, existing }: CategoryFieldProps) {
  const [focused, setFocused] = useState(false);

  const options = useMemo(() => {
    const query = value.trim().toLocaleLowerCase("es");
    return existing.filter(
      (c) =>
        c.toLocaleLowerCase("es").includes(query) &&
        c.toLocaleLowerCase("es") !== query,
    );
  }, [existing, value]);

  return (
    <Combobox
      activator={
        <Combobox.TextField
          label="Categoría"
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          maxLength={100}
          placeholder="Sin categoría"
          helpText="Agrupa los estilos en el admin y en el storefront. Escribe una nueva o elige una existente."
        />
      }
    >
      {focused && options.length > 0 ? (
        <Listbox onSelect={onChange}>
          {options.map((c) => (
            <Listbox.Option key={c} value={c} selected={c === value}>
              {c}
            </Listbox.Option>
          ))}
        </Listbox>
      ) : null}
    </Combobox>
  );
}
