"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { FRAME_SHADOWS } from "@/entities/product/lib/frameStyle";
import {
  DIFFICULTY_LABELS,
  type StyleDifficulty,
} from "@/entities/art-style/model/difficulty";

interface LandingStyleCardProps {
  id: string;
  displayName: string;
  difficulty: StyleDifficulty;
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
  "transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_22px_40px_-14px_rgba(16,54,66,0.50)]";

export function LandingStyleCard({
  id,
  displayName,
  difficulty,
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
            Preview unavailable
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

        <span className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          <span className="material-symbols-outlined text-[14px]">brush</span>
          {DIFFICULTY_LABELS[difficulty]}
        </span>
      </div>

      <p className="text-center font-bold text-slate-dark">{displayName}</p>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(id)}
          className={`${overlayClasses} cursor-pointer`}
          aria-label={`Choose the ${displayName} style`}
        />
      ) : (
        <Link
          href={`/create?style_id=${encodeURIComponent(id)}`}
          className={overlayClasses}
          aria-label={`Create your pet portrait in the ${displayName} style`}
        />
      )}
    </article>
  );
}
