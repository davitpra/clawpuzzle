"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { Container } from "@/shared/ui/Container";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import type { CartItem } from "@/context/CartContext";
import { formatPrice } from "@/entities/product/lib/variantPresentation";
import { trackEvent } from "@/shared/lib/analytics/track";
import { generateArtEvent } from "@/shared/lib/analytics/events";
import { CRAFTING_MESSAGES } from "../model/crafting-messages";
import { FormatArtwork } from "./FormatArtwork";

/** "G" de Google en sus colores oficiales, para el botón de guardar. */
function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/** Lo que se vende al terminar la vista previa: una variante ya resuelta. */
export interface PuzzleOffer {
  productTitle: string;
  productImage: string;
  formatLabel: string;
  variantId: string;
  price: string;
  currencyCode: string;
}

interface IAGeneratingStepProps {
  generationId: string | null;
  styleName: string | null;
  /** Sin oferta (Shopify no respondió) solo se enlaza al arte guardado. */
  offer: PuzzleOffer | null;
  /** Imagen del estilo: se ve en el cuadro mientras se genera la vista previa. */
  styleImage?: string | null;
  /** Medidas (cm) del formato: dan la proporción y la escala del cuadro. */
  formatWidth?: number | null;
  formatHeight?: number | null;
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
 * Deliberadamente **no** reutiliza `IAThanksStep`: aquel arrastra el carrito
 * local y los CTAs de tienda. Lo que sí comparte es el layout, el cuadro con la
 * proporción del formato (`FormatArtwork`), el polling (`useGenerationStatus`)
 * y las frases rotativas.
 */
export function IAGeneratingStep({
  generationId,
  styleName,
  offer,
  styleImage,
  formatWidth,
  formatHeight,
  onRetry,
  retrying = false,
  retryError,
}: IAGeneratingStepProps) {
  const { status, imageUrl } = useGenerationStatus(generationId);
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const router = useRouter();
  const { isGuest } = useAuth();

  // GenerateArt / generate_art cuando la vista previa aparece, una vez por
  // generación (también tras un reintento, que trae otro `generationId`).
  const trackedGenerationId = useRef<string | null>(null);
  useEffect(() => {
    if (!generationId || !imageUrl) return;
    if (trackedGenerationId.current === generationId) return;
    trackedGenerationId.current = generationId;
    trackEvent(generateArtEvent(generationId, styleName, isGuest));
  }, [generationId, imageUrl, styleName, isGuest]);

  const isFailed = status === "failed";
  const isGenerating = !!generationId && !imageUrl && !isFailed;
  const isRevealing = !!imageUrl;
  // Mientras se genera, la imagen del estilo ocupa el cuadro (con pulso).
  const displayImage = imageUrl ?? styleImage ?? null;

  const craftingMessage = useRotatingMessage(CRAFTING_MESSAGES, {
    active: isGenerating,
  });

  const savedArtHref = generationId
    ? `/user/generations/${generationId}`
    : "/user/generations";

  // El invitado no tiene dónde guardar: "Guardar" abre Google y, al volver,
  // el arte ya es de su cuenta (mismo id si es nueva; fusionado si ya existía).
  // `useGoogleLogin` siempre llama al `onDone` del último render.
  const { signIn, pending: signingIn } = useGoogleSignIn({
    onDone: () => router.push(savedArtHref),
  });

  const order = async () => {
    if (!offer || !generationId || !imageUrl) return;
    setCheckoutError(null);
    const item: CartItem = {
      id: generationId,
      variantId: offer.variantId,
      name: offer.productTitle,
      size: offer.formatLabel,
      style: styleName ?? undefined,
      price: Number.parseFloat(offer.price) || 0,
      quantity: 1,
      img: offer.productImage,
      // _generation_id + _image_url viajan como attributes de la línea: el
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
      <section>
        <Container>
          <div className="flex-1 flex flex-col md:flex-row animate-in fade-in duration-700">
            <FormatArtwork
              image={displayImage}
              formatWidth={formatWidth}
              formatHeight={formatHeight}
              isGenerating={isGenerating}
              alt="Vista previa del arte de tu mascota"
            />

            <div className="w-full md:w-1/2 flex items-center justify-center px-10 py-14 bg-white">
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-5 max-w-sm w-full">
                <h1 className="font-display text-5xl md:text-6xl font-black text-slate-dark tracking-tight leading-none">
                  {isRevealing
                    ? "¡Tu vista previa está lista!"
                    : isFailed
                      ? "Algo no salió bien"
                      : "Creando tu arte"}
                </h1>

                <div className="flex items-center gap-3 w-full justify-center md:justify-start">
                  <div className="h-px flex-1 max-w-30 bg-[#E0DED9]" />
                </div>

                <p className="text-slate-dark/70 text-base leading-relaxed min-h-12">
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
                  <div className="flex w-full flex-col items-center md:items-start gap-4 mt-2">
                    {offer ? (
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
                              Number.parseFloat(offer.price) || 0,
                              offer.currencyCode,
                            )}`}
                      </button>
                    ) : (
                      <p className="text-sm text-slate-dark/60">
                        {isGuest
                          ? "Guárdalo con tu cuenta de Google para pedirlo impreso más adelante."
                          : "Tu arte quedó guardado en tu cuenta. Pronto podrás pedirlo impreso desde ahí."}
                      </p>
                    )}

                    {checkoutError && (
                      <p className="text-sm text-red-600">{checkoutError}</p>
                    )}

                    <p className="text-xs leading-relaxed text-slate-dark/60">
                      Producción en 3 días · Entrega en unos 3 días más ·
                      Envíos a todo Ecuador
                    </p>

                    {isGuest ? (
                      // Secundario del CTA de compra: borde de marca y logo de
                      // Google para que se lea como acción, sin competir con
                      // "Pedir mi rompecabezas".
                      <div className="flex w-full flex-col items-center md:items-start gap-2">
                        <button
                          type="button"
                          onClick={signIn}
                          disabled={signingIn}
                          aria-busy={signingIn}
                          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-primary bg-white px-6 py-3.5 text-base font-bold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          {signingIn ? (
                            <span className="material-symbols-outlined animate-spin text-[20px]">
                              progress_activity
                            </span>
                          ) : (
                            <GoogleLogo />
                          )}
                          {signingIn
                            ? "Abriendo Google…"
                            : "Guardar mi arte con Google"}
                        </button>
                        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                          <span className="material-symbols-outlined text-[18px]">
                            auto_awesome
                          </span>
                          Y recibe 4 vistas previas gratis más
                        </p>
                      </div>
                    ) : (
                      <Link
                        href={savedArtHref}
                        className="text-sm font-bold text-primary underline-offset-4 hover:underline"
                      >
                        Guardar y decidir después
                      </Link>
                    )}
                  </div>
                )}

                {isFailed && onRetry && (
                  <div className="flex w-full flex-col items-center gap-3 mt-2">
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
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
