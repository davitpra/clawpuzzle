"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useGenerateImage } from "@/hooks/useGenerateImage";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { defaultSelections, fetchStyleById, useStyle } from "@/hooks/useStyle";
import type { ShopifyProduct } from "@/lib/shopify";
import type { Style } from "@/entities/art-style/model/styles";
import type { BundleQuantity } from "@/entities/product/lib/bundle";
import { isDogVariant } from "@/entities/product/lib/variantOptions";
import ProductVariantSelector from "@/entities/product/ui/ProductVariantSelector";
import { trackEvent } from "@/shared/lib/analytics/track";
import {
  generateArtEvent,
  uploadPhotoEvent,
} from "@/shared/lib/analytics/events";
import {
  nextBundleStep,
  useBundleOrder,
  type BundleOrder,
  type BundleStep,
} from "../model/bundleOrder";
import { useCreateGeneration } from "../model/useCreateGeneration";
import {
  useReusablePortraits,
  type ReusablePortrait,
} from "../model/useReusablePortraits";
import type { Pet } from "./upload-step/types";
import { BundlePieceWatchers, BundleProgressIndicator } from "./BundleProgress";
import { BundleReviewStep } from "./BundleReviewStep";
import { IAHeader } from "./IAHeader";
import type { PuzzleOffer } from "./IAGeneratingStep";
import { IAPhotoStep } from "./IAPhotoStep";
import { IAStyleStep } from "./IAStyleStep";
import { ReusePortraitsRow } from "./ReusePortraitsRow";

interface BundleFlowProps {
  /** Cantidad elegida en la landing (`qty`); con un pedido en curso, manda el pedido. */
  quantity: BundleQuantity;
  /** Tema elegido en la ficha (`variant_id`): el de las piezas nuevas. */
  defaultVariantId: string | null;
  productRefId: string;
  formatId: string;
  offer: PuzzleOffer | null;
  /** Para el switch Perro | Gato de cada pieza. */
  shopifyProduct: ShopifyProduct | null;
  /** El producto aún se está resolviendo: las cards de estilo esperan al tema. */
  isProductLoading: boolean;
  formatWidth?: number | null;
  formatHeight?: number | null;
}

const omit = <T,>(map: Record<number, T>, key: number) => {
  const next = { ...map };
  delete next[key];
  return next;
};

/** `userSelections` solo viaja si el estilo tiene opciones. */
const selectionsOf = (style: Style | null) => {
  const s = defaultSelections(style);
  return Object.keys(s).length > 0 ? s : undefined;
};

/** Imagen del estilo con la que se ve la pieza mientras se genera. */
const styleImgFor = (style: Style | null, isDog: boolean) =>
  style ? ((isDog ? style.dogImg : null) ?? style.img) : null;

const backButton =
  "inline-flex items-center gap-1 text-sm font-bold text-slate-dark underline-offset-4 hover:underline";

/**
 * Pedido de 2 o 3 rompecabezas, uno por uno: estilo y foto del 1, estilo y
 * foto del 2… y al final la galería con el pago. Cada generación arranca al
 * enviar su foto, así que la del 1 avanza por detrás mientras se arma el 2 (el
 * worker procesa varias a la vez); la tira de miniaturas lo deja ver.
 *
 * El paso sale del pedido guardado (`nextBundleStep`), así que una recarga o
 * la vuelta desde `/credits` retoma donde iba. Exige cuenta: la landing ya pide
 * Google al elegir más de uno, y si aun así no la hay, se pide al enviar la
 * primera foto.
 */
export function BundleFlow({
  quantity,
  defaultVariantId,
  productRefId,
  formatId,
  offer,
  shopifyProduct,
  isProductLoading,
  formatWidth,
  formatHeight,
}: BundleFlowProps) {
  const { order, ensure, update, add, remove, dropPending, clear } =
    useBundleOrder();
  const { isAuthenticated, isAdmin, isLoading: isAuthLoading } = useAuth();
  const { balance, refresh: refreshCredits } = useCredits();
  const { generate } = useGenerateImage();
  const {
    submit,
    submitting,
    error: submitError,
    outOfCredits,
    reset: resetSubmitError,
  } = useCreateGeneration();

  const variantFallback = defaultVariantId ?? offer?.variantId ?? null;
  useEffect(() => {
    if (variantFallback) ensure(quantity, variantFallback);
  }, [ensure, quantity, variantFallback]);

  // Pieza ya generada a la que se le está eligiendo otro estilo.
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  // Generaciones del pedido que fallaron mientras se armaban las demás.
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const handleFailedChange = useCallback((generationId: string, failed: boolean) => {
    setFailedIds((ids) =>
      failed
        ? ids.includes(generationId)
          ? ids
          : [...ids, generationId]
        : ids.includes(generationId)
          ? ids.filter((id) => id !== generationId)
          : ids,
    );
  }, []);

  // Foto en curso. Cada rompecabezas empieza sin mascota elegida: lo normal es
  // que sea otra; la del anterior sigue a un clic en "O elige una que ya subiste".
  const [photos, setPhotos] = useState<File[]>([]);
  const [petName, setPetName] = useState("");
  const [activePet, setActivePet] = useState<Pet | null>(null);

  // El pedido actual sin pasar por el render, para callbacks estables.
  const orderRef = useRef<BundleOrder | null>(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const step: BundleStep | null = order
    ? editing !== null && order.pieces[editing]
      ? { kind: "style", index: editing }
      : nextBundleStep(order)
    : null;
  const piece = step && step.kind !== "review" ? order!.pieces[step.index] : null;
  const count = order?.pieces.length ?? quantity;

  const { style, isLoading: isStyleLoading } = useStyle(
    step?.kind === "photo" ? (piece?.styleId ?? null) : null,
  );

  const variantNode = useCallback(
    (id: string) =>
      shopifyProduct?.variants.edges.find((e) => e.node.id === id)?.node,
    [shopifyProduct],
  );
  const isDog = piece ? isDogVariant(variantNode(piece.variantId)) : false;

  // Cada paso nuevo empieza arriba: el anterior suele terminar en su botón.
  const stepKey = step ? `${step.kind}-${"index" in step ? step.index : ""}` : "";
  useEffect(() => {
    if (stepKey) window.scrollTo({ top: 0 });
  }, [stepKey]);

  // ---- Acciones sobre piezas ya generadas --------------------------------

  const regenerate = useCallback(
    async (index: number, newStyleId?: string) => {
      const current = orderRef.current?.pieces[index];
      if (!current?.payload) return;
      setBusy((b) => ({ ...b, [index]: true }));
      setErrors((e) => omit(e, index));
      try {
        let patch = {};
        let payload = current.payload;
        if (newStyleId) {
          const next = await fetchStyleById(newStyleId);
          payload = {
            ...payload,
            styleId: newStyleId,
            userSelections: selectionsOf(next),
          };
          patch = {
            styleId: newStyleId,
            styleName: next.name,
            styleImg: styleImgFor(next, isDogVariant(variantNode(current.variantId))),
          };
        }
        const g = await generate(payload);
        void refreshCredits();
        update(index, { ...patch, payload, generationId: g.id, imageUrl: null });
      } catch (err) {
        setErrors((e) => ({
          ...e,
          [index]:
            err instanceof Error && err.message
              ? err.message
              : "No se pudo crear el retrato. Inténtalo de nuevo.",
        }));
      } finally {
        setBusy((b) => omit(b, index));
      }
    },
    [generate, refreshCredits, update, variantNode],
  );

  const handleReady = useCallback(
    (index: number, imageUrl: string) => {
      const current = orderRef.current?.pieces[index];
      if (!current?.generationId || current.imageUrl) return;
      update(index, { imageUrl });
      trackEvent(generateArtEvent(current.generationId, current.styleName));
    },
    [update],
  );

  const handleRemove = (index: number) => {
    remove(index);
    // Los índices se corren: los estados por pieza ya no aplican.
    setBusy({});
    setErrors({});
  };

  // ---- Estilo ------------------------------------------------------------

  // Retratos ya creados con la cuenta: una pieza puede ser uno de ellos, sin
  // foto ni vista previa.
  const portraits = useReusablePortraits(formatId);
  const usedIds = (order?.pieces ?? [])
    .filter((_, i) => !step || step.kind === "review" || i !== step.index)
    .map((p) => p.generationId)
    .filter((id): id is string => !!id);

  const handlePortraitPick = (portrait: ReusablePortrait) => {
    if (!step || step.kind !== "style") return;
    setEditing(null);
    setErrors((e) => omit(e, step.index));
    update(step.index, {
      styleId: portrait.styleId,
      styleName: portrait.styleName,
      styleImg: null,
      petName: portrait.petName,
      generationId: portrait.generationId,
      payload: portrait.payload,
      imageUrl: portrait.imageUrl,
    });
  };

  const handleStyleSelect = (styleId: string) => {
    if (!step || step.kind !== "style") return;
    if (editing !== null) {
      setEditing(null);
      void regenerate(step.index, styleId);
      return;
    }
    update(step.index, { styleId, styleName: null, styleImg: null });
  };

  // ---- Foto --------------------------------------------------------------

  const submitPiece = async () => {
    if (step?.kind !== "photo" || !piece?.styleId) return;
    const index = step.index;
    try {
      const result = await submit({
        photos,
        // Raza y edad se editan luego desde /user, como en el flujo de uno.
        form: { name: petName, breed: "", age: "" },
        activePet,
        productRefId,
        formatId,
        styleId: piece.styleId,
        userSelections: selectionsOf(style),
        // Sin `productInfo`: el pedido no pasa por el carrito local.
        productInfo: null,
        styleName: style?.name ?? null,
      });
      update(index, {
        styleName: style?.name ?? null,
        styleImg: styleImgFor(style, isDog),
        petName: petName.trim() || null,
        generationId: result.generationId,
        payload: result.payload,
        imageUrl: null,
      });
      setPhotos([]);
      setActivePet(null);
      setPetName("");
      void refreshCredits();
    } catch {
      // El mensaje ya está en `submitError`; se muestra en el paso de foto.
    }
  };

  // Sin cuenta (enlace compartido, sesión vencida) se pide Google aquí; al
  // volver del popup se envía la foto. `useGoogleLogin` llama al `onDone` del
  // último render.
  const { signIn, pending: signingIn } = useGoogleSignIn({
    onDone: () => void submitPiece(),
  });

  const handlePhotoContinue = () => {
    resetSubmitError();
    if (isAuthLoading) return;
    trackEvent(
      uploadPhotoEvent(
        style?.name ?? null,
        !isAuthenticated,
        photos.length + (activePet?.photos?.length ?? 0),
      ),
    );
    if (!isAuthenticated) {
      signIn();
      return;
    }
    void submitPiece();
  };

  // ---- Aviso de vistas previas -------------------------------------------

  // Cada retrato gasta una vista previa (el admin no gasta). Se avisa antes de
  // empezar, no en la foto que ya no alcanza.
  const pendingCount = order
    ? editing !== null
      ? 1
      : order.pieces.filter((p) => !p.generationId).length
    : 0;
  const shortfall =
    step?.kind !== "review" && !isAdmin && balance !== null
      ? Math.max(0, pendingCount - balance)
      : 0;
  const reducedCount = count - shortfall;

  const previewsNotice =
    shortfall > 0 ? (
      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-amber-50 p-4 text-slate-dark">
        <p className="text-sm leading-snug">
          <strong>
            {balance === 0
              ? "Ya no te quedan vistas previas"
              : balance === 1
                ? "Te queda 1 vista previa"
                : `Te quedan ${balance} vistas previas`}
          </strong>{" "}
          y {pendingCount === 1 ? "falta 1 retrato" : `faltan ${pendingCount} retratos`}.
          Cada retrato usa una.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/credits"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Conseguir más vistas previas
          </Link>
          {editing === null && reducedCount >= 1 && reducedCount < count && (
            <button
              type="button"
              onClick={() => dropPending(shortfall)}
              className="inline-flex items-center rounded-xl border border-[#E0DED9] bg-white px-4 py-2.5 text-sm font-bold text-slate-dark transition-all hover:bg-gray-50"
            >
              Hacer solo {reducedCount} rompecabezas
            </button>
          )}
        </div>
      </div>
    ) : null;

  // ---- Render ------------------------------------------------------------

  // Barra de progreso: estilo y foto de cada rompecabezas, y la galería.
  const headerTotal = count * 2 + 1;
  const headerStep =
    !step || editing !== null
      ? step
        ? headerTotal
        : 1
      : step.kind === "review"
        ? headerTotal
        : step.index * 2 + (step.kind === "style" ? 1 : 2);

  // Con más de uno, el indicador del pedido (no al cambiar el estilo de uno ya
  // creado: ahí se vuelve a la galería). En el paso del estilo va en la
  // cabecera; en el de la foto, dentro de la tarjeta del estilo.
  const progressIndex =
    order && step && step.kind !== "review" && count > 1 && editing === null
      ? step.index
      : null;
  const progressFor = (size: "sm" | "lg") =>
    order && progressIndex !== null ? (
      <BundleProgressIndicator
        pieces={order.pieces}
        currentIndex={progressIndex}
        failedIds={failedIds}
        size={size}
      />
    ) : null;

  return (
    <>
      <IAHeader
        step={headerStep}
        totalSteps={headerTotal}
        indicator={step?.kind === "photo" ? null : progressFor("sm")}
      />
      {order && progressIndex !== null && (
        <BundlePieceWatchers
          pieces={order.pieces}
          onReady={handleReady}
          onFailedChange={handleFailedChange}
        />
      )}

      {!order || !step ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      ) : step.kind === "style" && piece ? (
        <IAStyleStep
          key={`style-${step.index}`}
          onSelect={handleStyleSelect}
          isDogTheme={isDog}
          isThemeLoading={isProductLoading}
          eyebrow={
            editing !== null
              ? `Nuevo estilo para el rompecabezas ${step.index + 1}`
              : null
          }
          themeSwitch={
            shopifyProduct ? (
              <ProductVariantSelector
                product={shopifyProduct}
                selectedVariantId={piece.variantId}
                onVariantChange={(variantId) => update(step.index, { variantId })}
                hideLabels
              />
            ) : null
          }
          reuse={
            portraits.length > 0 ? (
              <ReusePortraitsRow
                portraits={portraits}
                usedIds={usedIds}
                onPick={handlePortraitPick}
              />
            ) : null
          }
          notice={
            editing !== null || previewsNotice ? (
              <>
                {/* Los anteriores ya se están creando: se cambian desde la
                    galería, no volviendo atrás. */}
                {editing !== null && (
                  <button type="button" onClick={() => setEditing(null)} className={`${backButton} mb-3`}>
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Volver a tus retratos
                  </button>
                )}
                {previewsNotice}
              </>
            ) : null
          }
        />
      ) : step.kind === "photo" && piece ? (
        <IAPhotoStep
          key={`photo-${step.index}`}
          progress={progressFor("lg")}
          notice={previewsNotice}
          continueLabel={
            step.index + 1 < count
              ? `Continuar con el rompecabezas ${step.index + 2}`
              : count > 1
                ? `Ver mis ${count} retratos`
                : "Ver mi retrato"
          }
          styleName={style?.name ?? null}
          styleImg={styleImgFor(style, isDog)}
          photos={photos}
          onPhotosChange={setPhotos}
          petName={petName}
          onPetNameChange={setPetName}
          activePet={activePet}
          onSelectPet={setActivePet}
          onContinue={handlePhotoContinue}
          onChangeStyle={() => update(step.index, { styleId: null })}
          changeStyleHref={null}
          submitting={submitting || signingIn || isStyleLoading}
          error={submitError}
          outOfCredits={outOfCredits}
        />
      ) : (
        <BundleReviewStep
          pieces={order.pieces}
          offer={offer}
          formatWidth={formatWidth}
          formatHeight={formatHeight}
          busy={busy}
          errors={errors}
          onReady={handleReady}
          onRetry={(i) => void regenerate(i)}
          onChangeStyle={setEditing}
          onRemove={handleRemove}
          onAdd={add}
          onCheckout={clear}
        />
      )}
    </>
  );
}
