"use client";

import { useMemo } from "react";
import { usePublicStyles } from "@/hooks/usePublicStyles";
import { withPreviewArt } from "@/entities/art-style/api/fetchPublicStyles";
import {
  LandingStylesSkeleton,
  LandingStylesView,
  type LandingStylesHeading,
} from "@/widgets/studio-landing/ui/LandingStylesView";
import { LandingThemeProvider } from "@/widgets/studio-landing/model/LandingThemeContext";

interface IAStyleStepProps {
  onSelect: (styleId: string) => void;
  /** Variante Perro elegida en la ficha: las cards enseñan su segunda imagen. */
  isDogTheme?: boolean;
  /** El tema aún se está resolviendo; se muestra el skeleton mientras tanto. */
  isThemeLoading?: boolean;
}

const HEADING: LandingStylesHeading = {
  eyebrow: "Paso 1",
  title: "Elige tu estilo",
  subtitle: null,
};

/**
 * Paso de estilo del generador: se muestra cuando se llega desde la ficha del
 * producto (con producto y formato, sin estilo). Reutiliza las cards de la
 * landing; elegir una no navega fuera, lo resuelve `onSelect`.
 */
export function IAStyleStep({
  onSelect,
  isDogTheme = false,
  isThemeLoading = false,
}: IAStyleStepProps) {
  const { styles, isLoading, reload } = usePublicStyles();
  const withArt = useMemo(() => withPreviewArt(styles), [styles]);

  return (
    <main className="grow animate-in fade-in duration-500">
      {isLoading || isThemeLoading ? (
        <LandingStylesSkeleton sectionId="choose-style" compact {...HEADING} />
      ) : (
        <LandingThemeProvider isDogTheme={isDogTheme}>
          <LandingStylesView
            styles={withArt}
            sectionId="choose-style"
            compact
            onSelect={onSelect}
            onRetry={reload}
            {...HEADING}
          />
        </LandingThemeProvider>
      )}
    </main>
  );
}
