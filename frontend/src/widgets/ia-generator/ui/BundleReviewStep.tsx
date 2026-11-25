"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Container } from "@/shared/ui/Container";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import type { CartItem } from "@/context/CartContext";
import { nextBundleCost } from "@/entities/product/lib/bundle";
import { MAX_PIECES, type BundlePiece } from "../model/bundleOrder";
import { orderPricing } from "../model/orderPricing";
import type { PuzzleOffer } from "./IAGeneratingStep";
import { OrderReassurance, OrderTotal } from "./OrderTotal";
import { AddPetButton } from "./AddPetButton";

interface BundleReviewStepProps {
  pieces: BundlePiece[];
  offer: PuzzleOffer | null;
  formatWidth?: number | null;
  formatHeight?: number | null;
  /** Piezas con una acción en curso (reintento o cambio de estilo). */
  busy: Record<number, boolean>;
  /** Error de la última acción de cada pieza. */
  errors: Record<number, string>;
  /** El retrato de la pieza `index` ya se ve: se guarda para el pago. */
  onReady: (index: number, imageUrl: string) => void;
  onRetry: (index: number) => void;
  onChangeStyle: (index: number) => void;
  /** Otra mascota (foto nueva) para la pieza, con el mismo estilo. */
  onChangePet: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  /** El pago se abrió: el pedido en armado ya no hace falta. */
  onCheckout: () => void;
}

interface PieceCardProps {
  piece: BundlePiece;
  index: number;
  aspectRatio: string;
  busy: boolean;
  error: string | null;
  canRemove: boolean;
  onReady: (index: number, imageUrl: string) => void;
  /** La generación de esta pieza falló (o dejó de fallar tras un reintento). */
  onFailedChange: (generationId: string, failed: boolean) => void;
  onRetry: (index: number) => void;
  onChangeStyle: (index: number) => void;
  /** Otra mascota (foto nueva) para la pieza, con el mismo estilo. */
  onChangePet: (index: number) => void;
  onRemove: (index: number) => void;
}

/** Una fila de la tarjeta (estilo o mascota) con su botón para cambiarla. */
function PieceDetailRow({
  icon,
  label,
  value,
  changeLabel,
  onChange,
  disabled,
}: {
  icon: string;
  label: string;
  value: string | null;
  changeLabel: string;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <span
        aria-hidden="true"
        className="material-symbols-outlined shrink-0 text-[20px] text-slate-dark"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <span className="text-sm font-bold text-slate-dark">{value ?? "—"}</span>
      </div>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        aria-label={changeLabel}
        className="shrink-0 rounded-full border border-[#E0DED9] bg-white px-3.5 py-2 text-sm font-bold text-slate-dark transition-all hover:border-slate-dark hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        Cambiar
      </button>
    </div>
  );
}

/** Una pieza del pedido: sigue su propia generación. */
function PieceCard({
  piece,
  index,
  aspectRatio,
  busy,
  error,
  canRemove,
  onReady,
  onFailedChange,
  onRetry,
  onChangeStyle,
  onChangePet,
  onRemove,
}: PieceCardProps) {
  // Lo ya listo no se vuelve a consultar (recarga con todo listo).
  const { status, imageUrl: polledUrl } = useGenerationStatus(
    piece.imageUrl ? null : piece.generationId,
  );
  const imageUrl = piece.imageUrl ?? polledUrl;

  useEffect(() => {
    if (polledUrl && !piece.imageUrl) onReady(index, polledUrl);
  }, [polledUrl, piece.imageUrl, index, onReady]);

  const isFailed = !imageUrl && status === "failed" && !busy;

  useEffect(() => {
    if (piece.generationId) onFailedChange(piece.generationId, isFailed);
  }, [piece.generationId, isFailed, onFailedChange]);
  const isGenerating = busy || (!imageUrl && !isFailed);
  const n = index + 1;

  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <div
        className="relative w-full overflow-hidden bg-[#EFEAE1] shadow-sm"
        style={{ aspectRatio } as CSSProperties}
      >
        {(imageUrl ?? piece.styleImg) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={imageUrl ?? piece.styleImg ?? undefined}
            src={(imageUrl ?? piece.styleImg) as string}
            alt={imageUrl ? `Retrato ${n}` : ""}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
          />
        )}

        {isGenerating && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-white/40" />
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-full bg-white px-2 py-1.5 text-xs font-bold text-slate-dark shadow-sm">
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
              <span className="truncate">Creando…</span>
            </div>
          </>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 p-2 text-center">
            <span className="text-xs font-bold text-slate-dark">No salió bien</span>
            {piece.payload && (
              <button
                type="button"
                onClick={() => onRetry(index)}
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-dark"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Reintentar
              </button>
            )}
          </div>
        )}

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Quitar el rompecabezas ${n}`}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-slate-dark shadow-sm transition-all hover:bg-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      <span className="mt-1.5 font-display text-base font-bold text-slate-dark">
        Rompecabezas {n}
      </span>
      <div className="divide-y divide-slate-dark/10 border-y border-slate-dark/10">
        <PieceDetailRow
          icon="palette"
          label="Estilo"
          value={piece.styleName}
          changeLabel={`Cambiar el estilo del rompecabezas ${n}`}
          onChange={() => onChangeStyle(index)}
          disabled={isGenerating || !piece.payload}
        />
        <PieceDetailRow
          icon="pets"
          label="Mascota"
          value={piece.petName}
          changeLabel={`Cambiar la mascota del rompecabezas ${n}`}
          onChange={() => onChangePet(index)}
          disabled={isGenerating}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

/**
 * Galería del pedido de varios rompecabezas: cada retrato se genera por su
 * lado (arrancó al enviar su foto) y el pago se abre cuando están todos.
 * Una línea de 1 por retrato: Shopify suma las unidades y aplica el descuento.
 */
export function BundleReviewStep({
  pieces,
  offer,
  formatWidth,
  formatHeight,
  busy,
  errors,
  onReady,
  onRetry,
  onChangeStyle,
  onChangePet,
  onRemove,
  onAdd,
  onCheckout,
}: BundleReviewStepProps) {
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Generaciones que fallaron, por id: un reintento trae otro id.
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const handleFailedChange = useCallback((id: string, value: boolean) => {
    setFailed((prev) => (!!prev[id] === value ? prev : { ...prev, [id]: value }));
  }, []);

  const count = pieces.length;
  const ready = pieces.filter((p) => p.imageUrl).length;
  const allReady = ready === count;
  const pricing = orderPricing(offer, count);
  const canOrder = allReady && !!offer && pricing.listPrice > 0;
  const canAdd = count < MAX_PIECES && !!offer && pricing.listPrice > 0;

  const hasDims =
    !!formatWidth && !!formatHeight && formatWidth > 0 && formatHeight > 0;
  const aspectRatio = hasDims ? `${formatWidth} / ${formatHeight}` : "2 / 3";

  const order = async () => {
    if (!offer || !canOrder) return;
    setCheckoutError(null);
    const items: CartItem[] = pieces.map((piece) => ({
      id: piece.generationId as string,
      variantId: piece.variantId,
      name: offer.productTitle,
      size: offer.formatLabel,
      style: piece.styleName ?? undefined,
      // Unitario con descuento: InitiateCheckout lleva el total real.
      price: pricing.unitPrice,
      quantity: 1,
      img: offer.productImage,
      // _generation_id + _image_url viajan como attributes de la línea: el
      // webhook de órdenes los usa para asociar el arte al pedido.
      generationId: piece.generationId ?? undefined,
      imageUrl: piece.imageUrl ?? undefined,
    }));
    const result = await startCheckout(items);
    if (result.status === "redirect") {
      onCheckout();
      return;
    }
    setCheckoutError(
      result.message ??
        "No pudimos iniciar el pago. Inténtalo de nuevo en un momento.",
    );
  };

  const hasFailed = pieces.some(
    (p, i) => errors[i] || (p.generationId && failed[p.generationId]),
  );
  const waiting = !allReady && !hasFailed;
  const ctaLabel = isCheckingOut
    ? "Abriendo el pago…"
    : allReady
      ? count === 1
        ? "Pedir mi rompecabezas"
        : `Pedir mis ${count} rompecabezas`
      : hasFailed
        ? `Pedir mis ${count} rompecabezas`
        : "Creando tus retratos…";

  return (
    <main className="grow bg-white py-6 md:py-10 animate-in fade-in duration-700">
      <Container>
        {/* Escritorio: la fila del título mide lo que el título; la altura de la
            lista va a la segunda fila, para que el total no se aleje. */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-[1.2fr_1fr] md:grid-rows-[auto_1fr] md:gap-x-14">
          <header className="flex flex-col gap-1 md:col-start-2 md:row-start-1">
            <span
              className={`text-sm font-bold uppercase tracking-wider ${
                allReady ? "text-green-700" : "text-text-muted"
              }`}
            >
              {allReady ? "Tus retratos están listos" : "Creando tus retratos"}
            </span>
            <h1 className="font-display text-3xl font-black leading-tight tracking-tight text-slate-dark md:text-5xl">
              {allReady
                ? count === 1
                  ? "Tu rompecabezas"
                  : `Tus ${count} rompecabezas`
                : `${ready} de ${count} listos`}
            </h1>
            {!allReady && (
              <p className="text-base leading-relaxed text-text-muted">
                Se crean todos a la vez. Puedes quedarte aquí: van apareciendo
                solos.
              </p>
            )}
          </header>

          <ul
            aria-label="Tus retratos"
            className={`grid gap-3 md:col-start-1 md:row-span-2 md:row-start-1 md:self-start ${
              count === 1 ? "mx-auto w-full max-w-xs grid-cols-1" : "grid-cols-2"
            }`}
          >
            {pieces.map((piece, i) => (
              <PieceCard
                key={piece.generationId ?? `piece-${i}`}
                piece={piece}
                index={i}
                aspectRatio={aspectRatio}
                busy={!!busy[i]}
                error={errors[i] ?? null}
                // Con una acción en curso los índices no se pueden correr.
                canRemove={count > 1 && Object.keys(busy).length === 0}
                onReady={onReady}
                onFailedChange={handleFailedChange}
                onRetry={onRetry}
                onChangeStyle={onChangeStyle}
                onChangePet={onChangePet}
                onRemove={onRemove}
              />
            ))}
          </ul>

          {/* Escritorio: total y botón quedan fijos bajo la cabecera mientras
              se bajan los retratos. */}
          <div className="flex flex-col gap-5 md:col-start-2 md:row-start-2 md:sticky md:top-[97px] md:self-start">
            {canAdd && (
              <AddPetButton
                cost={pricing.money(nextBundleCost(pricing.listPrice, count))}
                onClick={onAdd}
              />
            )}

            {offer && pricing.listPrice > 0 ? (
              <>
                <OrderTotal pricing={pricing} />

                <button
                  type="button"
                  onClick={() => void order()}
                  disabled={!canOrder || isCheckingOut}
                  aria-busy={isCheckingOut || waiting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ctaLabel}
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isCheckingOut || waiting ? "animate-spin" : ""
                    }`}
                  >
                    {isCheckingOut || waiting ? "progress_activity" : "arrow_forward"}
                  </span>
                </button>

                {!allReady && hasFailed && (
                  <p className="-mt-2 text-center text-sm text-text-muted">
                    Reintenta el retrato que falló, o quítalo del pedido.
                  </p>
                )}
                {checkoutError && (
                  <p className="text-sm text-red-600">{checkoutError}</p>
                )}

                <OrderReassurance showBalanceNote />
              </>
            ) : (
              <p className="text-sm text-text-muted">
                Tus retratos quedaron guardados en tu cuenta. No pudimos cargar
                el precio del rompecabezas: vuelve a intentarlo en un momento.
              </p>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
