"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface IAStyleBannerProps {
  styleName: string | null;
  styleImg: string | null;
  /** Se ejecuta antes de navegar a /#styles (limpia el borrador guardado). */
  onChangeStyle?: () => void;
  /**
   * Destino de "Cambiar"; por defecto las cards de la landing. Con `null` es un
   * botón que solo llama a `onChangeStyle` (el flujo por rompecabezas cambia de
   * paso sin navegar).
   */
  changeStyleHref?: string | null;
  /**
   * Fila sobre el estilo, separada por una línea; p. ej. el progreso del pedido
   * ("Rompecabezas 2 de 2").
   */
  top?: ReactNode;
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
const CHANGE_STYLE_CLASS =
  "shrink-0 text-base font-bold text-slate-dark underline underline-offset-4 transition-colors hover:text-primary";

export function IAStyleBanner({
  styleName,
  styleImg,
  onChangeStyle,
  changeStyleHref = "/#styles",
  top = null,
}: IAStyleBannerProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#E5E0D8] bg-white">
      {top && <div className="border-b border-[#E5E0D8] p-4">{top}</div>}

      <div className="flex items-center gap-4 p-4">
        <div className="aspect-2/3 w-10 shrink-0 overflow-hidden bg-[#EFEAE1]">
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

        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm text-text-muted">Tu estilo</p>
          <p className="line-clamp-2 font-display text-base font-bold text-slate-dark">
            {styleName ?? "Cargando…"}
          </p>
        </div>

        {changeStyleHref === null ? (
          // Sin destino ni acción, el estilo es fijo (cambio de mascota).
          onChangeStyle && <button
            type="button"
            onClick={onChangeStyle}
            aria-label="Cambiar estilo"
            className={CHANGE_STYLE_CLASS}
          >
            Cambiar
          </button>
        ) : (
          <Link
            href={changeStyleHref}
            onClick={onChangeStyle}
            aria-label="Cambiar estilo"
            className={CHANGE_STYLE_CLASS}
          >
            Cambiar
          </Link>
        )}
      </div>
    </div>
  );
}
