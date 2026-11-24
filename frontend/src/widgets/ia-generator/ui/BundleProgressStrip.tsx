"use client";

import { useEffect } from "react";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import type { BundlePiece } from "../model/bundleOrder";

interface BundleProgressStripProps {
  pieces: BundlePiece[];
  /** La pieza que se está armando ahora. */
  currentIndex: number;
  /** El retrato de la pieza `index` ya se ve: se guarda en el pedido. */
  onReady: (index: number, imageUrl: string) => void;
}

function StripItem({
  piece,
  index,
  isCurrent,
  onReady,
}: {
  piece: BundlePiece;
  index: number;
  isCurrent: boolean;
  onReady: (index: number, imageUrl: string) => void;
}) {
  // Solo se consulta lo que se está generando; lo listo ya trae su imagen.
  const { status, imageUrl: polledUrl } = useGenerationStatus(
    piece.imageUrl ? null : piece.generationId,
  );
  useEffect(() => {
    if (polledUrl && !piece.imageUrl) onReady(index, polledUrl);
  }, [polledUrl, piece.imageUrl, index, onReady]);

  const imageUrl = piece.imageUrl ?? polledUrl;
  const isGenerating = !!piece.generationId && !imageUrl && status !== "failed";
  const isFailed = !!piece.generationId && !imageUrl && status === "failed";
  const thumb = imageUrl ?? (piece.generationId ? piece.styleImg : null);

  const label = isCurrent
    ? "Ahora"
    : imageUrl
      ? "Listo"
      : isGenerating
        ? "Creando…"
        : isFailed
          ? "Revisar"
          : "Después";

  return (
    <li className="flex w-20 flex-col items-center gap-1">
      <div
        className={`relative aspect-2/3 w-16 overflow-hidden rounded-xl ${
          thumb ? "bg-[#EFEAE1]" : "border-2 border-dashed border-[#E0DED9] bg-white"
        } ${isCurrent ? "ring-2 ring-slate-dark ring-offset-2" : ""}`}
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={thumb}
            src={thumb}
            alt={imageUrl ? `Retrato ${index + 1}` : ""}
            className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
          />
        )}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40">
            <span className="flex size-8 items-center justify-center rounded-full bg-white shadow-sm">
              <span className="material-symbols-outlined animate-spin text-[18px] text-slate-dark">
                progress_activity
              </span>
            </span>
          </div>
        )}
        {imageUrl && (
          <span className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-green-600 text-white shadow-sm">
            <span className="material-symbols-outlined text-[14px]">check</span>
          </span>
        )}
        {!thumb && (
          <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-black text-text-muted">
            {index + 1}
          </span>
        )}
      </div>
      <span
        className={`whitespace-nowrap text-center text-xs leading-tight ${
          isCurrent ? "font-bold text-slate-dark" : isFailed ? "text-red-600" : "text-text-muted"
        }`}
      >
        {index + 1} · {label}
      </span>
    </li>
  );
}

/**
 * Una miniatura por rompecabezas sobre los pasos de estilo y foto: deja ver
 * que los anteriores se están creando por detrás mientras se arma el actual.
 * Cada miniatura sigue su generación y guarda el retrato en cuanto está listo.
 */
export function BundleProgressStrip({
  pieces,
  currentIndex,
  onReady,
}: BundleProgressStripProps) {
  return (
    <ol aria-label="Tus rompecabezas" className="mb-4 flex justify-center gap-2">
      {pieces.map((piece, i) => (
        <StripItem
          key={piece.generationId ?? `piece-${i}`}
          piece={piece}
          index={i}
          isCurrent={i === currentIndex}
          onReady={onReady}
        />
      ))}
    </ol>
  );
}
