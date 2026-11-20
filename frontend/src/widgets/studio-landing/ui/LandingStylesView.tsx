import type { ReactNode } from "react";
import { Container } from "@/shared/ui/Container";
import LightRays from "@/shared/ui/LightRays";
import type { PublicStyleWithArt } from "@/entities/art-style/api/fetchPublicStyles";
import { LandingStylesByCategory } from "./LandingStylesByCategory";
import { LandingStylesEmpty } from "./LandingStylesEmpty";

export interface LandingStylesHeading {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
}

interface SectionProps extends LandingStylesHeading {
  background?: string;
  /** Menos aire arriba: para cuando la sección abre la página (paso de `/create`). */
  compact?: boolean;
  /** Ancla de la sección. La landing usa `#styles`, destino de sus CTA. */
  sectionId?: string;
}

function SectionHeading({
  eyebrow = "Estilos",
  title = "Elige tu estilo",
  subtitle = "Elige el look que mejor va con tu mascota. Así se verá impreso en tu rompecabezas.",
  compact = false,
}: LandingStylesHeading & { compact?: boolean }) {
  return (
    <div className={`text-center md:mb-14 ${compact ? "mb-4" : "mb-6"}`}>
      {/* `eyebrow={null}` lo quita; sin la prop sale "Estilos". */}
      {eyebrow && (
        <span className="mb-3 inline-flex md:mb-5 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
        {title}
      </h2>
      {/* `subtitle={null}` lo quita; sin la prop sale el texto por defecto. */}
      {subtitle && (
        <p className="mx-auto mt-4 hidden max-w-lg text-base md:block leading-relaxed text-slate-dark/55">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SectionShell({
  background = "bg-white",
  sectionId = "styles",
  compact = false,
  children,
}: {
  background?: string;
  sectionId?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={sectionId}
      className={`relative w-full scroll-mt-24 overflow-hidden ${compact ? "pt-6 md:pt-8" : "pt-12 md:pt-20"} pb-20 md:pb-20 ${background}`}
    >
      {children}
    </section>
  );
}

export function LandingStylesSkeleton({
  background,
  sectionId,
  compact,
  ...heading
}: SectionProps) {
  return (
    <SectionShell background={background} sectionId={sectionId} compact={compact}>
      <Container>
        <SectionHeading compact={compact} {...heading} />
        <div className="flex gap-4 overflow-hidden md:grid md:grid-cols-4 md:gap-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex w-[72%] shrink-0 flex-col gap-4 sm:w-[45%] md:w-auto"
            >
              <div className="aspect-2/3 animate-pulse bg-slate-200" />
              <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </Container>
    </SectionShell>
  );
}

interface LandingStylesViewProps extends SectionProps {
  styles: PublicStyleWithArt[];
  /** Con él las cards eligen en sitio en vez de enlazar a `/create`. */
  onSelect?: (styleId: string) => void;
  /** Reintento del estado vacío; por defecto `router.refresh()`. */
  onRetry?: () => void;
}

/**
 * La sección de estilos sin la carga de datos: la usan la landing (servidor,
 * vía `LandingStyles`) y el paso de estilo de `/create` (cliente).
 */
export function LandingStylesView({
  styles,
  onSelect,
  onRetry,
  background,
  sectionId,
  compact,
  ...heading
}: LandingStylesViewProps) {
  return (
    <SectionShell background={background} sectionId={sectionId} compact={compact}>
      <Container>
        <SectionHeading compact={compact} {...heading} />
        {styles.length === 0 ? (
          <LandingStylesEmpty onRetry={onRetry} />
        ) : (
          <LandingStylesByCategory
            styles={styles}
            onSelect={onSelect}
            compact={compact}
          />
        )}
      </Container>
      <LightRays />
    </SectionShell>
  );
}
