"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { FRAME_SHADOWS } from "@/entities/product/lib/frameStyle";
import { useLandingTheme } from "../model/LandingThemeContext";

interface LandingStyleCardProps {
  id: string;
  displayName: string;
  artUrl: string;
  artAlt: string;
  /** Imagen para la variante Perro de la ficha; sin ella se usa `artUrl`. */
  dogArtUrl?: string;
  dogArtAlt?: string;
  /**
   * Con `onSelect` la card es un botón (paso de estilo de `/create`); sin él,
   * un link a `/create?style_id=…` (landing).
   */
  onSelect?: (id: string) => void;
  /**
   * El nombre va sobre la imagen en vez de debajo: ahorra alto sin achicar la
   * imagen (paso de `/create`, para que asome el segundo carrusel).
   */
  nameOverlay?: boolean;
  /** Elegida en el paso de estilo de `/create`: borde y check. */
  selected?: boolean;
}

const overlayClasses =
  "absolute inset-0 z-10 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

const posterClasses =
  "transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_22px_40px_-14px_rgba(41,44,64,0.50)]";

export function LandingStyleCard({
  id,
  displayName,
  artUrl,
  artAlt,
  dogArtUrl,
  dogArtAlt,
  onSelect,
  nameOverlay = false,
  selected = false,
}: LandingStyleCardProps) {
  const { isDogTheme } = useLandingTheme();
  const useDogArt = isDogTheme && !!dogArtUrl;
  const src = useDogArt ? dogArtUrl : artUrl;
  const alt = useDogArt ? (dogArtAlt ?? artAlt) : artAlt;
  // Se guarda qué imagen falló: al cambiar de tema la otra puede cargar bien.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageFailed = failedSrc === src;

  return (
    <article className="relative flex flex-col gap-4">
      <div
        className={`${posterClasses} ${FRAME_SHADOWS.art} relative aspect-2/3 overflow-hidden bg-cream ${
          selected ? "ring-[3px] ring-slate-dark ring-offset-2" : ""
        }`}
      >
        {imageFailed ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-dark/55">
            Vista previa no disponible
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 639px) 72vw, (max-width: 1023px) 33vw, 25vw"
            className="h-full w-full object-cover"
            onError={() => setFailedSrc(src)}
          />
        )}
        {selected && (
          <span className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-slate-dark text-white shadow-md animate-in zoom-in duration-200">
            <span className="material-symbols-outlined text-[20px]">check</span>
          </span>
        )}
        {nameOverlay && (
          <p className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-dark/80 via-slate-dark/40 to-transparent px-3 pt-10 pb-3 text-center font-bold text-white">
            {displayName}
          </p>
        )}
      </div>

      {!nameOverlay && (
        <p className="text-center font-bold text-slate-dark">{displayName}</p>
      )}
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(id)}
          className={`${overlayClasses} cursor-pointer`}
          aria-label={`Elegir el estilo ${displayName}`}
          aria-pressed={selected}
        />
      ) : (
        <Link
          href={`/create?style_id=${encodeURIComponent(id)}`}
          className={overlayClasses}
          aria-label={`Crear el rompecabezas de tu mascota en estilo ${displayName}`}
        />
      )}
    </article>
  );
}
