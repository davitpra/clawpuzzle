"use client";

import type { ReusablePortrait } from "../model/useReusablePortraits";
import { StepCarousel } from "./StepCarousel";

interface ReusePortraitsRowProps {
  portraits: ReusablePortrait[];
  /** Retratos que ya están en otra pieza del pedido. */
  usedIds?: string[];
  onPick: (portrait: ReusablePortrait) => void;
}

/**
 * "¿Ya creaste uno?" sobre el paso de estilo: pedir un retrato que ya se creó,
 * sin subir fotos ni gastar vistas previas. Muestra todos los de la cuenta.
 */
export function ReusePortraitsRow({
  portraits,
  usedIds = [],
  onPick,
}: ReusePortraitsRowProps) {
  if (portraits.length === 0) return null;

  return (
    <section aria-labelledby="reuse-portraits-title">
      <StepCarousel
        label="Tus retratos"
        heading={
          <div className="flex flex-col gap-1">
            <h2
              id="reuse-portraits-title"
              className="font-display text-2xl font-black tracking-tight text-slate-dark md:text-3xl"
            >
              ¿Ya creaste uno?
            </h2>
            <p className="text-sm text-text-muted md:text-base">
              Pídelo otra vez sin subir fotos ni gastar vistas previas.
            </p>
          </div>
        }
      >
        {portraits.map((p) => {
          const used = usedIds.includes(p.generationId);
          const name = p.petName || "Retrato";
          const description = [p.petName, p.styleName].filter(Boolean).join(" · ") || "Retrato";
          return (
            <li key={p.generationId}>
              <button
                type="button"
                onClick={() => onPick(p)}
                disabled={used}
                aria-label={
                  used ? `${description} (ya está en tu pedido)` : `Usar ${description}`
                }
                className="group flex w-full cursor-pointer flex-col gap-2 text-left disabled:cursor-not-allowed"
              >
                <span className="relative block aspect-2/3 w-full overflow-hidden bg-[#EFEAE1] shadow-sm transition-all duration-300 ease-out group-enabled:group-hover:-translate-y-1.5 group-enabled:group-hover:shadow-[0_22px_40px_-14px_rgba(41,44,64,0.50)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover ${used ? "opacity-40" : ""}`}
                  />
                  {used && (
                    <span className="absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-dark shadow-sm">
                      En tu pedido
                    </span>
                  )}
                </span>
                <span className="flex flex-col px-0.5">
                  <span className="truncate font-bold text-slate-dark">{name}</span>
                  <span className="truncate text-sm text-text-muted">
                    {used ? "Pídelo otra vez" : "Listo para pedir"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </StepCarousel>
    </section>
  );
}
