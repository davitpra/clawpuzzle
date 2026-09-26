"use client";

import { useMemo } from "react";
import { usePublicStyles } from "@/hooks/usePublicStyles";
import { withPreviewArt } from "@/entities/art-style/api/fetchPublicStyles";
import {
  LandingStylesSkeleton,
  LandingStylesView,
  type LandingStylesHeading,
} from "@/widgets/studio-landing/ui/LandingStylesView";

interface IAStyleStepProps {
  onSelect: (styleId: string) => void;
}

const HEADING: LandingStylesHeading = {
  eyebrow: "Step 1",
  title: "Choose Your Style",
  subtitle:
    "Pick the look you want for your pet. Next, you'll upload the photo we'll turn into art.",
};

/**
 * Paso de estilo del generador: se muestra cuando se llega desde la ficha del
 * producto (con producto y formato, sin estilo). Reutiliza las cards de la
 * landing; elegir una no navega fuera, lo resuelve `onSelect`.
 */
export function IAStyleStep({ onSelect }: IAStyleStepProps) {
  const { styles, isLoading, reload } = usePublicStyles();
  const withArt = useMemo(() => withPreviewArt(styles), [styles]);

  return (
    <main className="grow animate-in fade-in duration-500">
      {isLoading ? (
        <LandingStylesSkeleton sectionId="choose-style" {...HEADING} />
      ) : (
        <LandingStylesView
          styles={withArt}
          sectionId="choose-style"
          onSelect={onSelect}
          onRetry={reload}
          {...HEADING}
        />
      )}
    </main>
  );
}
