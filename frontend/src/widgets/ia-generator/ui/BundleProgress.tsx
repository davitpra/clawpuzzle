"use client";

import { useEffect } from "react";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import type { BundlePiece } from "../model/bundleOrder";

// ---- Seguimiento -----------------------------------------------------------

function PieceWatcher({
  piece,
  index,
  onReady,
  onFailedChange,
}: {
  piece: BundlePiece;
  index: number;
  onReady: (index: number, imageUrl: string) => void;
  onFailedChange: (generationId: string, failed: boolean) => void;
}) {
  // Solo se consulta lo que se está generando; lo listo ya trae su imagen.
  const { status, imageUrl } = useGenerationStatus(
    piece.imageUrl ? null : piece.generationId,
  );
  useEffect(() => {
    if (imageUrl && !piece.imageUrl) onReady(index, imageUrl);
  }, [imageUrl, piece.imageUrl, index, onReady]);

  const failed = !!piece.generationId && !piece.imageUrl && !imageUrl && status === "failed";
  useEffect(() => {
    if (piece.generationId) onFailedChange(piece.generationId, failed);
  }, [piece.generationId, failed, onFailedChange]);

  return null;
}

/**
 * Sigue las generaciones del pedido mientras se arman las demás piezas y
 * guarda cada retrato en cuanto está listo. No pinta nada: el indicador se
 * dibuja dos veces (cabecera en desktop, tarjeta en móvil) y así no se
 * consulta cada generación por duplicado.
 */
export function BundlePieceWatchers({
  pieces,
  onReady,
  onFailedChange,
}: {
  pieces: BundlePiece[];
  onReady: (index: number, imageUrl: string) => void;
  onFailedChange: (generationId: string, failed: boolean) => void;
}) {
  return (
    <>
      {pieces.map((piece, i) => (
        <PieceWatcher
          key={piece.generationId ?? `piece-${i}`}
          piece={piece}
          index={i}
          onReady={onReady}
          onFailedChange={onFailedChange}
        />
      ))}
    </>
  );
}

// ---- Indicador -------------------------------------------------------------

/** "El primero ya está listo", "Los anteriores se están creando"… */
function summary(pieces: BundlePiece[], currentIndex: number, failedIds: string[]) {
  const previous = pieces.slice(0, currentIndex);
  const remaining = pieces.length - currentIndex - 1;
  if (previous.length === 0) {
    return remaining === 1
      ? "Luego armas el segundo"
      : `Luego armas los otros ${remaining}`;
  }
  const one = previous.length === 1;
  if (previous.some((p) => p.generationId && failedIds.includes(p.generationId))) {
    return one ? "Revisa el primero al final" : "Revisa los anteriores al final";
  }
  if (previous.every((p) => p.imageUrl)) {
    return one ? "El primero ya está listo" : "Los anteriores ya están listos";
  }
  return one ? "El primero se está creando" : "Los anteriores se están creando";
}

function PieceThumb({
  piece,
  index,
  isCurrent,
  failed,
  large,
}: {
  piece: BundlePiece;
  index: number;
  isCurrent: boolean;
  failed: boolean;
  large: boolean;
}) {
  const badge = `absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full text-white ring-2 ring-white ${
    large ? "size-4" : "size-3.5"
  }`;

  const isGenerating = !!piece.generationId && !piece.imageUrl && !failed;
  const thumb = isCurrent
    ? null
    : (piece.imageUrl ?? (piece.generationId ? piece.styleImg : null));

  return (
    <li
      aria-label={`Rompecabezas ${index + 1}: ${
        isCurrent
          ? "ahora"
          : piece.imageUrl
            ? "listo"
            : failed
              ? "revisar"
              : isGenerating
                ? "creándose"
                : "después"
      }`}
      className={`relative flex aspect-2/3 shrink-0 items-center justify-center rounded-md ${large ? "w-10" : "w-7"} ${
        thumb
          ? "overflow-hidden bg-[#EFEAE1]"
          : isCurrent
            ? "border-2 border-slate-dark bg-white"
            : "border-2 border-dashed border-[#E0DED9] bg-white"
      }`}
    >
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={thumb}
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
        />
      )}
      {!thumb && (
        <span
          className={`font-display font-black ${large ? "text-base" : "text-sm"} ${isCurrent ? "text-slate-dark" : "text-text-muted"}`}
        >
          {index + 1}
        </span>
      )}
      {isGenerating && thumb && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/50">
          <span className="material-symbols-outlined animate-spin text-[14px] text-slate-dark">
            progress_activity
          </span>
        </span>
      )}
      {piece.imageUrl && !isCurrent && (
        <span className={`${badge} bg-green-600`}>
          <span className="material-symbols-outlined text-[10px] font-bold">check</span>
        </span>
      )}
      {failed && !isCurrent && (
        <span className={`${badge} bg-red-600`}>
          <span className="material-symbols-outlined text-[10px] font-bold">priority_high</span>
        </span>
      )}
    </li>
  );
}

/**
 * "Rompecabezas 2 de 2 · El primero ya está listo" con una miniatura por
 * pieza: va en la cabecera del pedido mientras se elige el estilo y, en
 * tamaño `lg`, sobre el estilo en el paso de la foto (`IAStyleBanner`).
 */
export function BundleProgressIndicator({
  pieces,
  currentIndex,
  failedIds,
  size = "sm",
}: {
  pieces: BundlePiece[];
  currentIndex: number;
  failedIds: string[];
  size?: "sm" | "lg";
}) {
  const large = size === "lg";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ol aria-label="Tus rompecabezas" className="flex items-center gap-1.5">
        {pieces.map((piece, i) => (
          <PieceThumb
            key={piece.generationId ?? `piece-${i}`}
            piece={piece}
            index={i}
            isCurrent={i === currentIndex}
            failed={!!piece.generationId && failedIds.includes(piece.generationId)}
            large={large}
          />
        ))}
      </ol>
      <div className="flex min-w-0 flex-col leading-tight">
        <span
          className={`truncate font-bold text-slate-dark ${large ? "font-display text-lg" : "text-sm"}`}
        >
          Rompecabezas {currentIndex + 1} de {pieces.length}
        </span>
        <span className={`truncate text-text-muted ${large ? "text-sm" : "text-xs"}`}>
          {summary(pieces, currentIndex, failedIds)}
        </span>
      </div>
    </div>
  );
}
