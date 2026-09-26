"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import type { CartItem } from "@/context/CartContext";
import { formatPrice } from "@/entities/product/lib/variantPresentation";
import { CRAFTING_MESSAGES } from "../model/crafting-messages";

/** Una variante comprable del formato elegido (p. ej. tema Perro | Gato). */
export interface PuzzleOption {
  variantId: string;
  label: string;
  price: string;
  currencyCode: string;
  available: boolean;
}

/** Lo que se vende al terminar la vista previa. */
export interface PuzzleOffer {
  productTitle: string;
  productImage: string;
  formatLabel: string;
  options: PuzzleOption[];
  /** Variante que el cliente eligió en la ficha, si llegó desde ella. */
  defaultVariantId: string | null;
}

interface IAGeneratingStepProps {
  generationId: string | null;
  styleName: string | null;
  /** Sin oferta (Shopify no respondió) solo se enlaza al arte guardado. */
  offer: PuzzleOffer | null;
  /** Reintenta la generación fallida. Sin handler no se muestra el botón. */
  onRetry?: () => void;
  retrying?: boolean;
  retryError?: string | null;
}

/**
 * Último paso del embudo de lanzamiento: espera, revela la vista previa y la
 * vende. La vista previa es lo gratis; aquí mismo se pide el rompecabezas con
 * checkout directo a Shopify (`startCheckout([item])`, igual que `/credits`),
 * porque `/cart` está bloqueado en lanzamiento.
 *
 * Deliberadamente **no** reutiliza `IAThanksStep`: aquel arrastra el mockup
 * enmarcado, el carrito local y los CTAs de tienda. Lo que sí comparte es el
 * polling (`useGenerationStatus`) y las frases rotativas.
 */
export function IAGeneratingStep({
  generationId,
  styleName,
  offer,
  onRetry,
  retrying = false,
  retryError,
}: IAGeneratingStepProps) {
  const { status, imageUrl } = useGenerationStatus(generationId);
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const [pickedVariantId, setPickedVariantId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const isFailed = status === "failed";
  const isGenerating = !!generationId && !imageUrl && !isFailed;
  const isRevealing = !!imageUrl;

  const craftingMessage = useRotatingMessage(CRAFTING_MESSAGES, {
    active: isGenerating,
  });

  const availableOptions = offer?.options.filter((o) => o.available) ?? [];
  const selectedOption =
    availableOptions.find((o) => o.variantId === pickedVariantId) ??
    availableOptions.find((o) => o.variantId === offer?.defaultVariantId) ??
    availableOptions[0] ??
    null;

  const savedArtHref = generationId
    ? `/user/generations/${generationId}`
    : "/user/generations";

  const order = async () => {
    if (!offer || !selectedOption || !generationId || !imageUrl) return;
    setCheckoutError(null);
    const item: CartItem = {
      id: generationId,
      variantId: selectedOption.variantId,
      name: offer.productTitle,
      size: offer.formatLabel,
      style: styleName ?? undefined,
      price: Number.parseFloat(selectedOption.price) || 0,
      quantity: 1,
      img: offer.productImage,
      // generation_id + image_url viajan como attributes de la línea: el
      // webhook de órdenes los usa para asociar el arte al pedido.
      generationId,
      imageUrl,
    };
    const result = await startCheckout([item]);
    if (result.status !== "redirect") {
      setCheckoutError(
        result.message ??
          "No pudimos iniciar el pago. Inténtalo de nuevo en un momento.",
      );
    }
  };

  return (
    <main className="grow flex flex-col bg-white">
      <Container>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center animate-in fade-in duration-700">
          <div className="relative flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-3xl bg-cream/50">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Vista previa del arte de tu mascota"
                className="size-full object-cover animate-in fade-in zoom-in-95 duration-700"
                decoding="async"
              />
            ) : (
              <span
                className={`material-symbols-outlined text-6xl text-primary ${
                  isFailed ? "" : "animate-spin"
                }`}
              >
                {isFailed ? "error" : "progress_activity"}
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl font-black tracking-tight text-slate-dark md:text-5xl">
            {isRevealing
              ? "¡Tu vista previa está lista!"
              : isFailed
                ? "Algo no salió bien"
                : "Creando tu arte"}
          </h1>

          <p className="min-h-12 max-w-md text-base leading-relaxed text-slate-dark/70">
            {isRevealing ? (
              "Así se verá tu rompecabezas. Si te encanta, lo imprimimos en MDF de 3 mm y te lo enviamos a casa."
            ) : isFailed ? (
              "Hubo un problema al crear tu arte. Vuelve a intentarlo."
            ) : (
              <span
                key={craftingMessage}
                className="inline-block animate-in fade-in duration-700"
              >
                {craftingMessage}
              </span>
            )}
          </p>

          {isRevealing && (
            <div className="flex w-full max-w-sm flex-col items-center gap-4">
              {offer && availableOptions.length > 1 && (
                <fieldset className="w-full">
                  <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-dark/60">
                    Tema del rompecabezas
                  </legend>
                  <div className="flex justify-center gap-2">
                    {availableOptions.map((option) => {
                      const active =
                        option.variantId === selectedOption?.variantId;
                      return (
                        <button
                          key={option.variantId}
                          type="button"
                          onClick={() => setPickedVariantId(option.variantId)}
                          aria-pressed={active}
                          className={`rounded-full border px-5 py-2 text-sm font-bold transition-all ${
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-[#E5E0D8] bg-white text-slate-dark hover:bg-gray-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {offer && selectedOption ? (
                <button
                  type="button"
                  onClick={() => void order()}
                  disabled={isCheckingOut}
                  aria-busy={isCheckingOut}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isCheckingOut ? "animate-spin" : ""
                    }`}
                  >
                    {isCheckingOut ? "progress_activity" : "extension"}
                  </span>
                  {isCheckingOut
                    ? "Abriendo el pago…"
                    : `Pedir mi rompecabezas · ${formatPrice(
                        Number.parseFloat(selectedOption.price) || 0,
                        selectedOption.currencyCode,
                      )}`}
                </button>
              ) : (
                <p className="text-sm text-slate-dark/60">
                  Tu arte quedó guardado en tu cuenta. Pronto podrás pedirlo
                  impreso desde ahí.
                </p>
              )}

              {checkoutError && (
                <p className="text-sm text-red-600">{checkoutError}</p>
              )}

              <p className="text-xs leading-relaxed text-slate-dark/60">
                Producción en 3 días · Entrega en unos 3 días más ·
                Envíos a todo Ecuador
              </p>

              <Link
                href={savedArtHref}
                className="text-sm font-bold text-primary underline-offset-4 hover:underline"
              >
                Guardar y decidir después
              </Link>
            </div>
          )}

          {isFailed && onRetry && (
            <div className="flex w-full max-w-xs flex-col items-center gap-3">
              <button
                onClick={onRetry}
                disabled={retrying}
                aria-busy={retrying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    retrying ? "animate-spin" : ""
                  }`}
                >
                  {retrying ? "progress_activity" : "refresh"}
                </span>
                {retrying ? "Reintentando…" : "Reintentar"}
              </button>
              {retryError && (
                <p className="text-sm text-red-600">{retryError}</p>
              )}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
