"use client";

import { useMemo, type ReactNode } from "react";
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
  /** Sobre el título; p. ej. "Rompecabezas 2 de 3" al armar un bundle. */
  eyebrow?: ReactNode;
  /** Switch Perro | Gato, para cuando el siguiente retrato es de otra mascota. */
  themeSwitch?: ReactNode;
  /** Sobre todo lo demás: "Atrás" y el aviso de vistas previas del pedido. */
  notice?: ReactNode;
  /** Antes de las cards: "Tus retratos", para pedir uno ya creado. */
  reuse?: ReactNode;
}

const HEADING: LandingStylesHeading = {
  eyebrow: null,
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
  eyebrow = null,
  themeSwitch = null,
  notice = null,
  reuse = null,
}: IAStyleStepProps) {
  const { styles, isLoading, reload } = usePublicStyles();
  const withArt = useMemo(() => withPreviewArt(styles), [styles]);

  return (
    <main className="grow animate-in fade-in duration-500">
      {notice && <div className="mx-auto w-full max-w-3xl px-6 pt-6">{notice}</div>}
      {themeSwitch && (
        <div className="mx-auto w-full max-w-xs px-6 pt-6">{themeSwitch}</div>
      )}
      {reuse && <div className="mx-auto w-full max-w-3xl px-6 pt-6">{reuse}</div>}
      {isLoading || isThemeLoading ? (
        <LandingStylesSkeleton sectionId="choose-style" compact {...HEADING} eyebrow={eyebrow} />
      ) : (
        <LandingThemeProvider isDogTheme={isDogTheme}>
          <LandingStylesView
            styles={withArt}
            sectionId="choose-style"
            compact
            onSelect={onSelect}
            onRetry={reload}
            {...HEADING}
            eyebrow={eyebrow}
          />
        </LandingThemeProvider>
      )}
    </main>
  );
}
