"use client";

import OptionChips from "@/shared/ui/OptionChips";
import {
  DIFFICULTY_LABELS,
  type StyleDifficulty,
} from "@/entities/art-style/model/difficulty";

export interface StyleChoice {
  id: string;
  displayName: string;
  difficulty: StyleDifficulty;
}

interface ProductStyleSelectorProps {
  styles: StyleChoice[];
  value: string;
  onChange: (styleId: string) => void;
}

/**
 * Selector de estilo para el producto de lanzamiento, que admite cualquier
 * estilo activo: el elegido viaja como `style_id` a `/create`.
 */
export default function ProductStyleSelector({
  styles,
  value,
  onChange,
}: ProductStyleSelectorProps) {
  if (styles.length === 0) return null;

  const selected = styles.find((s) => s.id === value);

  return (
    <div className="flex flex-col gap-3">
      <OptionChips
        name="style-option"
        label="Style"
        value={value}
        options={styles.map((s) => ({ value: s.id, label: s.displayName }))}
        onChange={onChange}
      />

      {selected && (
        <p className="font-body text-sm text-text-muted leading-relaxed">
          Paint-by-numbers difficulty:{" "}
          <span className="font-bold text-text-main">
            {DIFFICULTY_LABELS[selected.difficulty]}
          </span>
        </p>
      )}
    </div>
  );
}
