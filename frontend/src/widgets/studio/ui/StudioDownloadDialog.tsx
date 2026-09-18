"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExportControls as ExportControlsState } from "@/features/pbn-studio";
import ExportControls from "@/features/pbn-studio/ui/ExportControls";
import { usePbnProduct } from "@/features/pbn-purchase";
import {
  formatPrice,
  variantLabel,
} from "@/entities/product/lib/variantPresentation";
import { PurchaseSizePicker } from "@/entities/product/ui/PurchaseSizePicker";
import { useAuth } from "@/context/AuthContext";
import type { CartItem } from "@/context/CartContext";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import { LAUNCH_MODE } from "@/shared/config/launch";
import Modal from "@/shared/ui/Modal";
import type { SavedPbnRef } from "../model/useSavePbnFlow";
import { PbnCanvasMockup } from "./PbnCanvasMockup";

interface StudioDownloadDialogProps {
  onClose: () => void;
  entry: "ai" | "saved-pbn" | "direct";
  generationId: string | null;
  processedSrc: string;
  exp: ExportControlsState;
  hasOutput: boolean;
  ensureSaved: () => Promise<SavedPbnRef | null>;
  saving: boolean;
  saveError: string | null;
  limitReached: boolean;
}

export function StudioDownloadDialog({
  onClose,
  entry,
  generationId,
  processedSrc,
  exp,
  hasOutput,
  ensureSaved,
  saving,
  saveError,
  limitReached,
}: StudioDownloadDialogProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const offerCandidate =
    LAUNCH_MODE && entry !== "direct" && Boolean(generationId);
  const offerEnabled = offerCandidate && !authLoading && isAuthenticated;
  const { product, variants, defaultImage, loading, unavailable } =
    usePbnProduct(offerEnabled);
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const [downloadOnly, setDownloadOnly] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const defaultVariant =
    variants.length === 3
      ? variants[Math.floor(variants.length / 2)]
      : variants[0];
  const selected =
    variants.find((variant) => variant.id === variantId) ?? defaultVariant;
  const checkingAvailability = offerCandidate && (authLoading || loading);
  const showOffer =
    offerEnabled &&
    !checkingAvailability &&
    !downloadOnly &&
    !unavailable &&
    Boolean(product && selected);
  const showDownload =
    downloadOnly ||
    !offerCandidate ||
    (!authLoading && !isAuthenticated) ||
    (offerEnabled && !loading && (unavailable || variants.length === 0));

  const orderCanvas = async () => {
    if (!product || !selected || saving || isCheckingOut) return;
    setCheckoutError(null);

    const pbn = await ensureSaved();
    if (!pbn) return;

    const item: CartItem = {
      id: `pbn-${pbn.id}-${selected.id}`,
      variantId: selected.id,
      name: product.title,
      size: variantLabel(selected),
      price: Number.parseFloat(selected.price.amount) || 0,
      quantity: 1,
      img: selected.image?.url ?? defaultImage ?? "",
      paintByNumbersId: pbn.id,
    };
    const result = await startCheckout([item]);
    if (result.status !== "redirect") {
      setCheckoutError(
        result.status === "no-variants"
          ? "This canvas size isn't available for checkout. Please choose another size."
          : (result.message ??
              "We couldn't start checkout. Please try again in a moment."),
      );
    }
  };

  const price = selected
    ? formatPrice(
        Number.parseFloat(selected.price.amount) || 0,
        selected.price.currencyCode,
      )
    : null;
  const busy = saving || isCheckingOut;

  return (
    <Modal
      open
      onClose={onClose}
      title={showDownload ? "Download your PDF" : "Your art, ready to paint"}
      maxWidth={showDownload ? "max-w-lg" : "max-w-5xl"}
      label="Download or order your paint-by-numbers"
    >
      {checkingAvailability && !downloadOnly ? (
        <div className="grid min-h-96 place-items-center p-8 text-center">
          <div>
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
            <p className="mt-3 font-display text-lg font-black text-slate-dark">
              Preparing your canvas preview…
            </p>
            <button
              type="button"
              onClick={() => setDownloadOnly(true)}
              className="mt-4 text-sm font-bold text-primary underline underline-offset-4"
            >
              No thanks, download free PDF
            </button>
          </div>
        </div>
      ) : showOffer ? (
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="bg-[#f5efe6] p-4 sm:p-6 lg:p-8">
            <PbnCanvasMockup src={processedSrc} />
          </div>

          <div className="@container flex flex-col p-5 sm:p-7 lg:p-8">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                Custom canvas
              </p>
              <h3 className="mt-2 font-display text-2xl font-black leading-tight text-slate-dark sm:text-3xl">
                Paint your own artwork on canvas
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                We print your numbered design on a ready-to-paint canvas and
                ship it directly to you.
              </p>
            </div>

            <div className="my-6 h-px bg-[#E0DED9]" />

            <PurchaseSizePicker
              label="Choose a canvas size"
              ariaLabel="Canvas size"
              value={selected.id}
              onChange={(value) => {
                setVariantId(value);
                setCheckoutError(null);
              }}
              options={variants.map((variant) => ({
                value: variant.id,
                label: variantLabel(variant),
                price: formatPrice(
                  Number.parseFloat(variant.price.amount) || 0,
                  variant.price.currencyCode,
                ),
              }))}
            />

            <div className="mt-auto rounded-xl bg-cream px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-dark">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  local_shipping
                </span>
                Ships across Canada · ~5 business days
              </p>
            </div>

            {(saveError || checkoutError) && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <p>{saveError ?? checkoutError}</p>
                {limitReached && (
                  <Link
                    href="/user/pbn"
                    className="mt-1 inline-block font-bold underline underline-offset-2"
                  >
                    Manage my paintings
                  </Link>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => void orderCanvas()}
              disabled={busy || !selected}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-display text-base font-black text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && (
                <span className="material-symbols-outlined animate-spin text-[20px]">
                  progress_activity
                </span>
              )}
              {saving
                ? "Saving your design…"
                : isCheckingOut
                  ? "Opening checkout…"
                  : `Order on canvas${price ? ` — ${price}` : ""}`}
            </button>
            <button
              type="button"
              onClick={() => setDownloadOnly(true)}
              disabled={busy}
              className="mt-3 min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-slate-dark underline decoration-black/30 underline-offset-4 transition-colors hover:bg-cream hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              No thanks, download free PDF
            </button>
          </div>
        </div>
      ) : showDownload ? (
        <div className="p-6">
          <ExportControls exp={exp} hasOutput={hasOutput} onClose={onClose} />
        </div>
      ) : null}
    </Modal>
  );
}
