import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import CompareSlider from "./CompareSlider";
import LightRays from "@/shared/ui/LightRays";

export interface ShowcaseFeature {
  text: string;
  /** Material Symbols name. Falls back to a checkmark when omitted. */
  icon?: string;
}

export interface ShowcaseImage {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  width: number;
  height: number;
  alt: string;
}

/** Single still image, shown instead of the before/after slider. */
export interface ShowcasePhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface ShowcaseCta {
  href: string;
  label: string;
}

interface StudioShowcaseProps {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  features?: ShowcaseFeature[];
  image?: ShowcaseImage;
  /** When set, replaces the compare slider (and its hint) with a still image. */
  photo?: ShowcasePhoto;
  /** `null` hides the button. */
  primaryCta?: ShowcaseCta | null;
  secondaryCta?: ShowcaseCta | null;
  /** Clase de fondo; pasar "" dentro de un `SectionFlow` para que lo ponga el wrapper. */
  background?: string;
}

const DEFAULT_FEATURES: ShowcaseFeature[] = [
  { text: "Tu vista previa, lista en segundos" },
  { text: "Impreso en MDF de 3 mm" },
  { text: "Gratis hasta que decides comprar" },
];

const DEFAULT_IMAGE: ShowcaseImage = {
  beforeSrc: "/studio/bengal-art.webp",
  afterSrc: "/studio/bengal-pbn.webp",
  width: 928,
  height: 1152,
  alt: "Retrato de un gato bengalí convertido en rompecabezas",
};

export default function StudioShowcase({
  eyebrow = "ClawPuzzle Studio",
  title = (
    <>
      Mira a tu mascota<br /> como rompecabezas, gratis
    </>
  ),
  description = "Sube una foto y mira cómo tu mejor amigo se convierte en arte en segundos. Sin compromiso: pruébalo y decide después.",
  features = DEFAULT_FEATURES,
  image = DEFAULT_IMAGE,
  photo,
  primaryCta = {
    href: "/create",
    label: "Pruébalo gratis",
  },
  secondaryCta = { href: "/catalog", label: "Ver rompecabezas" },
  background = "bg-cream",
}: StudioShowcaseProps) {
  return (
    <section
      className={`relative overflow-hidden w-full py-20 md:py-28 ${background}`}
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1 items-center flex flex-col gap-4 text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E0DED9] bg-white px-4 py-1.5 text-primary">
              <span className="material-symbols-outlined text-[16px]">
                pets
              </span>
              <span className="text-xs font-bold tracking-wider uppercase">
                {eyebrow}
              </span>
            </span>
            <h2 className="mt-5 font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
              {title}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-dark/70">
              {description}
            </p>

            {/* ── Feature bullets ── */}
            <ul className="mt-8 space-y-3">
              {features.map((feature) => (
                <li
                  key={feature.text}
                  className="flex items-center gap-3 text-sm text-slate-dark/75"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {feature.icon ? (
                      <span className="material-symbols-outlined text-[18px]">
                        {feature.icon}
                      </span>
                    ) : (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2.5 6.2 5 8.5l4.5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {feature.text}
                </li>
              ))}
            </ul>

            {(primaryCta || secondaryCta) && (
              <div className="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                {primaryCta && (
                  <Link
                    href={primaryCta.href}
                    className="flex w-full items-center justify-center rounded-xl bg-primary px-8 py-4 text-center sm:w-auto text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:bg-primary-dark"
                  >
                    {primaryCta.label}
                  </Link>
                )}
                {secondaryCta && (
                  <Link
                    href={secondaryCta.href}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 text-center sm:w-auto border-primary/20 bg-white px-8 py-[14px] text-base font-bold text-primary transition-all hover:scale-105 hover:border-primary hover:bg-primary/5"
                  >
                    {secondaryCta.label}
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-0.5"
                    >
                      arrow_forward
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ── Image ── */}
          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-md lg:max-w-lg">
              {/* Glow */}
              <div className="absolute -inset-4 -z-10 rounded-4xl bg-primary/20 blur-2xl" />
              <div className="overflow-hidden border border-white/10 bg-white/5 shadow-2xl">
                {photo ? (
                  <Image
                    src={photo.src}
                    width={photo.width}
                    height={photo.height}
                    alt={photo.alt}
                    sizes="(min-width: 1024px) 32rem, 28rem"
                    className="h-auto w-full"
                  />
                ) : (
                  <CompareSlider {...image} />
                )}
              </div>
              {/* Hint */}
              {!photo && (
                <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-dark shadow-lg">
                  <span className="size-2 rounded-full bg-primary" />
                  Desliza para comparar
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
      {/* Rayos de luz decorativos; último hijo para pintar por encima de todo el contenido (imagen incluida) sin bloquear clics. */}
      <LightRays />
    </section>
  );
}
