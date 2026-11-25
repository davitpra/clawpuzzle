"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { usePublicStyles } from "@/hooks/usePublicStyles";
import {
  withPreviewArt,
  type PublicStyleWithArt,
} from "@/entities/art-style/api/fetchPublicStyles";
import { Container } from "@/shared/ui/Container";
import LightRays from "@/shared/ui/LightRays";
import { LandingStyleCard } from "@/widgets/studio-landing/ui/LandingStyleCard";
import { LandingStylesEmpty } from "@/widgets/studio-landing/ui/LandingStylesEmpty";
import { LandingThemeProvider } from "@/widgets/studio-landing/model/LandingThemeContext";
import { StepCarousel } from "./StepCarousel";

interface IAStyleStepProps {
  /** Se llama al pulsar "Continuar" con el estilo marcado. */
  onSelect: (styleId: string) => void;
  /** Variante Perro elegida en la ficha: las cards enseñan su segunda imagen. */
  isDogTheme?: boolean;
  /** El tema aún se está resolviendo; se muestra el skeleton mientras tanto. */
  isThemeLoading?: boolean;
  /** Sobre el título; p. ej. "Nuevo estilo para el rompecabezas 2". */
  eyebrow?: ReactNode;
  /** Switch Perro | Gato, para cuando el siguiente retrato es de otra mascota. */
  themeSwitch?: ReactNode;
  /** Sobre todo lo demás: "Atrás" y el aviso de vistas previas del pedido. */
  notice?: ReactNode;
  /** Antes de los estilos: "¿Ya creaste uno?", para pedir uno ya creado. */
  reuse?: ReactNode;
}

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

/** Imagen del estilo con la que se ve en la barra de "Estilo elegido". */
const thumbFor = (item: PublicStyleWithArt, isDog: boolean) =>
  (isDog ? item.altArt?.imageUrl : null) ?? item.art.imageUrl;

/**
 * Hay vista previa gratis por delante: el visitante sin sesión tiene la suya
 * de invitado, y la cuenta, mientras le queden vistas previas. El invitado
 * con sesión ya la gastó (la sesión nace al generar).
 */
function useHasFreePreview() {
  const { hasSession, isAuthenticated, isAdmin } = useAuth();
  const { balance } = useCredits();
  if (!hasSession) return true;
  if (!isAuthenticated) return false;
  return isAdmin || (balance ?? 0) > 0;
}

/**
 * Paso de estilo del generador: se muestra cuando se llega desde la ficha del
 * producto (con producto y formato, sin estilo). Marcar una card no avanza:
 * se confirma con "Continuar" en la barra fija de abajo, que llama a `onSelect`.
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
  const groups = useMemo(() => groupByCategory(withArt), [withArt]);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasFreePreview = useHasFreePreview();

  const selected = withArt.find((s) => s.style.id === selectedId) ?? null;
  const visibleGroups = category
    ? groups.filter((g) => g.label === category)
    : groups;
  const showGroupTitles = groups.length > 1;

  return (
    <main className="relative grow overflow-hidden pb-44 animate-in fade-in duration-500 md:pb-36">
      <Container className="flex flex-col pt-6 md:pt-10">
        {notice}

        {reuse && (
          <>
            {reuse}
            <div className="my-6 flex items-center gap-4 md:my-8" role="separator">
              <span className="h-px flex-1 bg-[#E0DED9]" />
              <span className="text-sm text-text-muted">o crea uno nuevo</span>
              <span className="h-px flex-1 bg-[#E0DED9]" />
            </div>
          </>
        )}

        <section aria-labelledby="choose-style-title" id="choose-style" className="scroll-mt-24">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
            <div className="flex max-w-xl flex-col gap-1.5">
              {eyebrow && (
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  {eyebrow}
                </span>
              )}
              <h2
                id="choose-style-title"
                className="font-display text-3xl font-black tracking-tight text-slate-dark md:text-4xl"
              >
                Elige tu estilo
              </h2>
              <p className="text-sm leading-relaxed text-text-muted md:text-base">
                {/* Sin tema resuelto no se nombra al animal: pasaría de gato a perro. */}
                {isThemeLoading
                  ? "Así se ve cada estilo."
                  : `Así se ve cada estilo con un ${isDogTheme ? "perro" : "gato"}.`}{" "}
                Tu vista previa usará la foto de tu mascota.
              </p>
            </div>
            {themeSwitch && <div className="w-full shrink-0 md:w-64">{themeSwitch}</div>}
          </div>

          {isLoading || isThemeLoading ? (
            <StylesSkeleton />
          ) : withArt.length === 0 ? (
            <LandingStylesEmpty onRetry={reload} />
          ) : (
            <LandingThemeProvider isDogTheme={isDogTheme}>
              {showGroupTitles && (
                <div
                  role="group"
                  aria-label="Filtrar estilos por categoría"
                  className="mt-5 flex flex-wrap gap-2"
                >
                  <CategoryChip
                    label="Todos"
                    active={category === null}
                    onClick={() => setCategory(null)}
                  />
                  {groups.map((g) => (
                    <CategoryChip
                      key={g.label}
                      label={g.label}
                      active={category === g.label}
                      onClick={() => setCategory(g.label)}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-6 md:mt-8 md:gap-10">
                {visibleGroups.map((group) => (
                  <StepCarousel
                    key={group.label}
                    label={group.label}
                    heading={
                      showGroupTitles ? (
                        <h3 className="font-display text-lg font-black text-slate-dark md:text-xl">
                          {group.label}
                        </h3>
                      ) : null
                    }
                  >
                    {group.styles.map(({ style, art, altArt }) => (
                      <li key={style.id}>
                        <LandingStyleCard
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
                          onSelect={setSelectedId}
                          selected={style.id === selectedId}
                          nameOverlay
                        />
                      </li>
                    ))}
                  </StepCarousel>
                ))}
              </div>
            </LandingThemeProvider>
          )}
        </section>
      </Container>

      {/* Último hijo del `main`: los haces pintan sobre el contenido, como en la landing. */}
      <LightRays />

      <SelectionBar
        selectedName={selected?.style.displayName ?? null}
        selectedImg={selected ? thumbFor(selected, isDogTheme) : null}
        hasFreePreview={hasFreePreview}
        onContinue={() => {
          if (selectedId) onSelect(selectedId);
        }}
      />
    </main>
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
      className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-slate-dark bg-slate-dark text-white"
          : "border-[#E0DED9] bg-white text-slate-dark hover:border-slate-dark/40"
      }`}
    >
      {label}
    </button>
  );
}

function StylesSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-8 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`aspect-2/3 animate-pulse bg-slate-200 ${i >= 2 ? "hidden md:block" : ""} ${
            i === 3 ? "md:hidden lg:block" : ""
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Barra fija abajo: qué estilo está marcado y "Continuar". Sin estilo marcado
 * el botón queda desactivado.
 */
function SelectionBar({
  selectedName,
  selectedImg,
  hasFreePreview,
  onContinue,
}: {
  selectedName: string | null;
  selectedImg: string | null;
  hasFreePreview: boolean;
  onContinue: () => void;
}) {
  const disabled = !selectedName;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E0DED9] bg-white/95 backdrop-blur-sm">
      <Container className="flex items-center gap-4 py-3 md:py-4">
        {/* Desktop: estilo elegido a la izquierda */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          {selectedImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={selectedImg}
              src={selectedImg}
              alt=""
              className="aspect-2/3 h-14 shrink-0 object-cover shadow-sm animate-in fade-in duration-300"
            />
          ) : (
            <span className="aspect-2/3 h-14 shrink-0 border-2 border-dashed border-[#E0DED9]" />
          )}
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-xs text-text-muted">
              {selectedName ? "Estilo elegido" : "Ningún estilo elegido"}
            </span>
            <span className="truncate font-bold text-slate-dark">
              {selectedName ?? "Marca uno para seguir"}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col items-stretch gap-1.5 md:w-auto md:flex-row md:items-center md:gap-5">
          {hasFreePreview && (
            <span className="hidden text-sm text-text-muted md:inline">
              Tu primera vista previa es gratis
            </span>
          )}
          <button
            type="button"
            onClick={onContinue}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-base font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-dark/30 disabled:shadow-none"
          >
            {/* Móvil: el botón nombra el estilo; desktop lo muestra a la izquierda. */}
            <span className="md:hidden">
              {selectedName ? `Continuar con ${selectedName}` : "Elige un estilo"}
            </span>
            <span className="hidden md:inline">Continuar</span>
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
          <span className="text-center text-xs text-text-muted md:hidden">
            {hasFreePreview
              ? "Tu primera vista previa es gratis · puedes cambiar el estilo después"
              : "Puedes cambiar el estilo después"}
          </span>
        </div>
      </Container>
    </div>
  );
}
