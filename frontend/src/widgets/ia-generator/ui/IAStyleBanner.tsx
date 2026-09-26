"use client";

import Link from "next/link";

interface IAStyleBannerProps {
  styleName: string | null;
  styleImg: string | null;
  /** Se ejecuta antes de navegar a /#styles (limpia el borrador guardado). */
  onChangeStyle?: () => void;
  /** Destino de "Change style"; por defecto las cards de la landing. */
  changeStyleHref?: string;
}

/**
 * Cabecera del flujo de lanzamiento: recuerda qué estilo eligió el usuario y le
 * deja cambiarlo sin perderse. `/create` pasa como `changeStyleHref` su paso de
 * estilo (mismo producto y formato); por defecto, `/#styles`, el ancla de
 * `LandingStyles`.
 *
 * Usa `<img>` y no `next/image` porque la previsualización del estilo puede ser
 * el placeholder de `useStyle`, cuyo host no está en `next.config.ts`.
 */
export function IAStyleBanner({
  styleName,
  styleImg,
  onChangeStyle,
  changeStyleHref = "/#styles",
}: IAStyleBannerProps) {
  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[#E5E0D8] bg-cream/40 p-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-white">
        {styleImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={styleImg}
            alt={styleName ? `Estilo ${styleName}` : "Estilo elegido"}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-dark/50">
          Tu estilo
        </p>
        <p className="truncate font-display text-lg font-black text-slate-dark">
          {styleName ?? "Cargando…"}
        </p>
      </div>

      <Link
        href={changeStyleHref}
        onClick={onChangeStyle}
        className="shrink-0 rounded-lg border border-[#E5E0D8] bg-white px-3 py-2 text-sm font-bold text-slate-dark transition-colors hover:bg-gray-50"
      >
        Cambiar estilo
      </Link>
    </div>
  );
}
