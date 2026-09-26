"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { FRAME_SHADOWS } from "@/entities/product/lib/frameStyle";

interface LandingStyleCardProps {
  id: string;
  displayName: string;
  artUrl: string;
  artAlt: string;
  /**
   * Con `onSelect` la card es un botón (paso de estilo de `/create`); sin él,
   * un link a `/create?style_id=…` (landing).
   */
  onSelect?: (id: string) => void;
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
  onSelect,
}: LandingStyleCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="relative flex flex-col gap-4">
      <div
        className={`${posterClasses} ${FRAME_SHADOWS.art} relative aspect-2/3 overflow-hidden bg-cream`}
      >
        {imageFailed ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-dark/55">
            Vista previa no disponible
          </div>
        ) : (
          <Image
            src={artUrl}
            alt={artAlt}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      <p className="text-center font-bold text-slate-dark">{displayName}</p>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(id)}
          className={`${overlayClasses} cursor-pointer`}
          aria-label={`Elegir el estilo ${displayName}`}
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
