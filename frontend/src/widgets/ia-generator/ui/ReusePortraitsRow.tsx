"use client";

import type { ReusablePortrait } from "../model/useReusablePortraits";

interface ReusePortraitsRowProps {
  portraits: ReusablePortrait[];
  /** Retratos que ya están en otra pieza del pedido. */
  usedIds?: string[];
  onPick: (portrait: ReusablePortrait) => void;
}

/**
 * "Tus retratos" sobre el paso de estilo: pedir uno que ya se creó, sin subir
 * fotos ni gastar vistas previas.
 */
export function ReusePortraitsRow({
  portraits,
  usedIds = [],
  onPick,
}: ReusePortraitsRowProps) {
  if (portraits.length === 0) return null;

  return (
    <section aria-labelledby="reuse-portraits-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2
          id="reuse-portraits-title"
          className="font-display text-lg font-black text-slate-dark"
        >
          Tus retratos
        </h2>
        <p className="text-sm text-text-muted">
          Pide uno que ya creaste, sin subir fotos ni gastar vistas previas.
        </p>
      </div>

      <ul className="-mx-6 flex snap-x scroll-px-6 gap-3 overflow-x-auto px-6 pb-2">
        {portraits.map((p) => {
          const used = usedIds.includes(p.generationId);
          const caption =
            [p.petName, p.styleName].filter(Boolean).join(" · ") || "Retrato";
          return (
            <li key={p.generationId} className="w-24 shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onPick(p)}
                disabled={used}
                aria-label={used ? `${caption} (ya está en tu pedido)` : `Usar ${caption}`}
                className="group flex w-full flex-col gap-1 text-left disabled:cursor-not-allowed"
              >
                <span className="relative block aspect-2/3 w-full overflow-hidden rounded-xl bg-[#EFEAE1] shadow-sm transition-all group-hover:shadow-md group-enabled:group-hover:ring-2 group-enabled:group-hover:ring-slate-dark">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover ${used ? "opacity-40" : ""}`}
                  />
                  {used && (
                    <span className="absolute inset-x-1 bottom-1 rounded-full bg-white px-1.5 py-0.5 text-center text-[11px] font-bold text-slate-dark">
                      En tu pedido
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-text-muted">{caption}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
