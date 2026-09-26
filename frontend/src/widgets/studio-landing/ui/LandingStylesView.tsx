import type { ReactNode } from "react";
import { Container } from "@/shared/ui/Container";
import { Carousel } from "@/shared/ui/Carousel";
import LightRays from "@/shared/ui/LightRays";
import type { PublicStyleWithArt } from "@/entities/art-style/api/fetchPublicStyles";
import { LandingStyleCard } from "./LandingStyleCard";
import { LandingStylesEmpty } from "./LandingStylesEmpty";

export interface LandingStylesHeading {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
}

interface SectionProps extends LandingStylesHeading {
  background?: string;
  /** Ancla de la sección. La landing usa `#styles`, destino de sus CTA. */
  sectionId?: string;
}

function SectionHeading({
  eyebrow = "Estilos",
  title = "Una foto, tu estilo",
  subtitle = "Elige el look que mejor va con tu mascota. Así se verá impreso en tu rompecabezas.",
}: LandingStylesHeading) {
  return (
    <div className="mb-14 text-center">
      <span className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </span>
      <h2 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-dark/55">
        {subtitle}
      </p>
    </div>
  );
}

function SectionShell({
  background = "bg-white",
  sectionId = "styles",
  children,
}: {
  background?: string;
  sectionId?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={sectionId}
      className={`relative w-full scroll-mt-24 overflow-hidden py-20 ${background}`}
    >
      {children}
    </section>
  );
}

export function LandingStylesSkeleton({
  background,
  sectionId,
  ...heading
}: SectionProps) {
  return (
    <SectionShell background={background} sectionId={sectionId}>
      <Container>
        <SectionHeading {...heading} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-4">
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
  ...heading
}: LandingStylesViewProps) {
  return (
    <SectionShell background={background} sectionId={sectionId}>
      <Container>
        <SectionHeading {...heading} />
        {styles.length === 0 ? (
          <LandingStylesEmpty onRetry={onRetry} />
        ) : (
          <Carousel gap="gap-4 md:gap-8" perView={4} mobileSlides={2}>
            {styles.map(({ style, art }) => (
              <LandingStyleCard
                key={style.id}
                id={style.id}
                displayName={style.displayName}
                artUrl={art.imageUrl}
                artAlt={
                  art.altImage ?? `Ejemplo de retrato de mascota en estilo ${style.displayName}`
                }
                onSelect={onSelect}
              />
            ))}
          </Carousel>
        )}
      </Container>
      <LightRays />
    </SectionShell>
  );
}
