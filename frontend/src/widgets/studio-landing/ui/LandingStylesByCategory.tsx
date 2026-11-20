"use client";

import { useId, useState } from "react";
import { Carousel } from "@/shared/ui/Carousel";
import type { PublicStyleWithArt } from "@/entities/art-style/api/fetchPublicStyles";
import { LandingStyleCard } from "./LandingStyleCard";

/** Título del grupo de los estilos que no tienen categoría en el admin. */
const UNCATEGORIZED_LABEL = "Otros";

interface StyleGroup {
  label: string;
  styles: PublicStyleWithArt[];
}

/**
 * Agrupa por `category` respetando el orden del admin: cada categoría aparece
 * donde está su primer estilo, y los que no tienen categoría van al final.
 */
function groupByCategory(styles: PublicStyleWithArt[]): StyleGroup[] {
  const groups = new Map<string, PublicStyleWithArt[]>();
  for (const item of styles) {
    const key = item.style.category;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const named = [...groups]
    .filter(([key]) => key !== "")
    .map(([label, items]) => ({ label, styles: items }));
  const rest = groups.get("");
  return rest ? [...named, { label: UNCATEGORIZED_LABEL, styles: rest }] : named;
}

interface LandingStylesByCategoryProps {
  styles: PublicStyleWithArt[];
  onSelect?: (styleId: string) => void;
  /** Menos aire entre carruseles en mobile (paso de `/create`). */
  compact?: boolean;
}

/**
 * Con una sola categoría (o ninguna) es el carrusel de siempre. Con varias,
 * mobile muestra un carrusel por categoría (en `compact`, con chips arriba
 * que bajan a cada uno) y desktop un carrusel con chips para
 * filtrar.
 */
export function LandingStylesByCategory({
  styles,
  onSelect,
  compact = false,
}: LandingStylesByCategoryProps) {
  const groups = groupByCategory(styles);
  const [selected, setSelected] = useState<string | null>(null);
  const idPrefix = useId();
  const groupId = (index: number) => `${idPrefix}-category-${index}`;

  if (groups.length <= 1) {
    return (
      <StylesCarousel styles={styles} onSelect={onSelect} compact={compact} />
    );
  }

  const filtered =
    groups.find((g) => g.label === selected)?.styles ?? styles;

  return (
    <>
      {/* Mobile, paso de `/create`: chips que bajan a cada categoría, para
          que desde la primera carga se vea que hay más de un grupo de estilos. */}
      {compact && (
        <nav
          aria-label="Ir a una categoría de estilos"
          className="-mt-1 mb-5 flex flex-wrap justify-center gap-2 md:hidden"
        >
          {groups.map((group, index) => (
            <button
              key={group.label}
              type="button"
              onClick={() =>
                document
                  .getElementById(groupId(index))
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="cursor-pointer rounded-full border border-slate-dark/15 bg-white px-4 py-1.5 text-sm font-bold text-slate-dark/70 transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {group.label}
            </button>
          ))}
        </nav>
      )}

      {/* Mobile: un carrusel por categoría */}
      <div
        className={`flex flex-col md:hidden ${compact ? "gap-6" : "gap-10"}`}
      >
        {groups.map((group, index) => (
          <div key={group.label} id={groupId(index)} className="scroll-mt-24">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              {group.label}
            </h3>
            <StylesCarousel
              styles={group.styles}
              onSelect={onSelect}
              compact={compact}
            />
          </div>
        ))}
      </div>

      {/* Desktop: chips de filtro sobre un solo carrusel */}
      <div className="hidden md:block">
        <div
          role="group"
          aria-label="Filtrar estilos por categoría"
          className="mb-10 flex flex-wrap justify-center gap-3"
        >
          <CategoryChip
            label="Todos"
            active={selected === null}
            onClick={() => setSelected(null)}
          />
          {groups.map((group) => (
            <CategoryChip
              key={group.label}
              label={group.label}
              active={selected === group.label}
              onClick={() => setSelected(group.label)}
            />
          ))}
        </div>
        {/* `key`: Embla vuelve al inicio al cambiar de filtro. */}
        <StylesCarousel
          key={selected ?? "all"}
          styles={filtered}
          onSelect={onSelect}
          compact={compact}
        />
      </div>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-5 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-primary bg-primary text-white"
          : "border-slate-dark/15 bg-white text-slate-dark/70 hover:border-primary hover:text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function StylesCarousel({
  styles,
  onSelect,
  compact = false,
}: {
  styles: PublicStyleWithArt[];
  onSelect?: (styleId: string) => void;
  compact?: boolean;
}) {
  return (
    <Carousel gap="gap-4 md:gap-8" perView={4}>
      {styles.map(({ style, art, altArt }) => (
        <LandingStyleCard
          key={style.id}
          id={style.id}
          displayName={style.displayName}
          artUrl={art.imageUrl}
          artAlt={
            art.altImage ??
            `Ejemplo de retrato de mascota en estilo ${style.displayName}`
          }
          dogArtUrl={altArt?.imageUrl}
          dogArtAlt={
            altArt?.altImage ??
            `Ejemplo de retrato de perro en estilo ${style.displayName}`
          }
          onSelect={onSelect}
          nameOverlay={compact}
        />
      ))}
    </Carousel>
  );
}
