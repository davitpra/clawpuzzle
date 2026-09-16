"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type PointerEvent } from "react";
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
  pbnUrl: string;
  pbnAlt: string;
}

const posterClasses =
  "transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_22px_40px_-14px_rgba(16,54,66,0.50)]";

export function LandingStyleCard({
  id,
  displayName,
  difficulty,
  artUrl,
  artAlt,
  pbnUrl,
  pbnAlt,
}: LandingStyleCardProps) {
  const [variant, setVariant] = useState<"art" | "pbn">("art");
  const [imageFailed, setImageFailed] = useState(false);
  const showPbn = variant === "pbn";

  const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") {
      setImageFailed(false);
      setVariant("pbn");
    }
  };

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") {
      setImageFailed(false);
      setVariant("art");
    }
  };

  const selectVariant = (next: "art" | "pbn") => {
    setImageFailed(false);
    setVariant(next);
  };

  return (
    <article
      className="group relative flex flex-col gap-4"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div
        className={`${posterClasses} ${FRAME_SHADOWS.art} relative aspect-2/3 overflow-hidden bg-cream`}
      >
        {imageFailed ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-dark/55">
            Preview unavailable
          </div>
        ) : (
          <Image
            src={showPbn ? pbnUrl : artUrl}
            alt={showPbn ? pbnAlt : artAlt}
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

        <div
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 rounded-full bg-white/95 p-1 shadow-md backdrop-blur"
          aria-label="Preview variant"
        >
          {(["art", "pbn"] as const).map((option) => {
            const selected = option === variant;
            const label = option === "art" ? "Art" : "Paint by numbers";
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => selectVariant(option)}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors sm:text-[10px] ${
                  selected
                    ? "bg-primary text-white"
                    : "text-slate-dark/60 hover:text-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-center font-bold text-slate-dark">{displayName}</p>
      <Link
        href={`/create?style_id=${encodeURIComponent(id)}`}
        className="absolute inset-0 z-10 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label={`Create your pet portrait in the ${displayName} style`}
      />
    </article>
  );
}
