"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useCredits } from "@/hooks/useCredits";
import { Container } from "@/shared/ui/Container";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import type { CartItem } from "@/context/CartContext";
import { formatPrice } from "@/entities/product/lib/variantPresentation";
import { splitDeposit } from "@/entities/product/lib/deposit";
import { trackEvent } from "@/shared/lib/analytics/track";
import { generateArtEvent } from "@/shared/lib/analytics/events";
import { CRAFTING_MESSAGES } from "../model/crafting-messages";

/** "G" de Google en sus colores oficiales, para el botón de continuar. */
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

/** Fondo cálido de las superficies secundarias (fila del total, "¿Aún no…?"). */
const SOFT_SURFACE = "bg-[#F5F3EE]";

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
  /** Nombre de la mascota: personaliza el título. */
  petName?: string | null;
  /** Sin oferta (Shopify no respondió) solo se enlaza al arte guardado. */
  offer: PuzzleOffer | null;
  /** Imagen del estilo: se ve en el cuadro mientras se genera la vista previa. */
  styleImage?: string | null;
  /** Medidas (cm) del formato: dan la proporción del cuadro. */
  formatWidth?: number | null;
  formatHeight?: number | null;
  /** Reintenta la generación fallida. Sin handler no se muestra el botón. */
  onRetry?: () => void;
  retrying?: boolean;
  retryError?: string | null;
  /**
   * Vuelve al paso de estilo con la misma mascota. Se llama ya con sesión de
   * cuenta: el invitado pasa antes por Google.
   */
  onTryAnotherStyle?: () => void;
}

/**
 * El arte en una tarjeta con la proporción del formato. Mientras se genera
 * muestra la imagen del estilo con un velo pulsante y una píldora con el
 * estilo que se está aplicando.
 */
function ResultArtwork({
  image,
  formatWidth,
  formatHeight,
  isGenerating,
  styleName,
}: {
  image: string | null;
  formatWidth?: number | null;
  formatHeight?: number | null;
  isGenerating: boolean;
  styleName: string | null;
}) {
  // Sin medidas válidas del formato, 2:3 (el rompecabezas de lanzamiento).
  const hasDims =
    !!formatWidth && !!formatHeight && formatWidth > 0 && formatHeight > 0;
  const aspectRatio = hasDims ? `${formatWidth} / ${formatHeight}` : "2 / 3";
  const ratio = hasDims ? (formatWidth as number) / (formatHeight as number) : 2 / 3;

  return (
    // Escritorio: 90 % del alto bajo la cabecera de 73 px (`IAHeader`). Se fija
    // el ancho (no el alto) y la proporción da el alto; si la columna es más
    // estrecha que eso (tablet vertical), manda la columna sin deformar.
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-[#EFEAE1] shadow-lg md:w-[min(100%,calc((100dvh-73px)*0.9*var(--art-ratio)))]"
      style={{ aspectRatio, "--art-ratio": ratio } as CSSProperties}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image}
          src={image}
          alt="Vista previa del arte de tu mascota"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
        />
      )}
      {isGenerating && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse bg-white/40"
          />
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-dark shadow-sm">
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
            {styleName ? `Aplicando ${styleName}` : "Aplicando el estilo"}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Último paso del embudo de lanzamiento: espera, revela la vista previa y la
 * vende. La vista previa es lo gratis; aquí mismo se pide el rompecabezas con
 * checkout directo a Shopify (`startCheckout([item])`, igual que `/credits`),
 * porque `/cart` está bloqueado en lanzamiento.
 *
 * Móvil: título → arte → "Prueba otros estilos" → precio → pedir. Escritorio:
 * el arte a la izquierda y todo lo demás a la derecha, con el mismo DOM (la
 * rejilla recoloca el título).
 *
 * Deliberadamente **no** reutiliza `IAThanksStep`: aquel arrastra el carrito
 * local y los CTAs de tienda. Comparte el polling (`useGenerationStatus`) y las
 * frases rotativas.
 */
export function IAGeneratingStep({
  generationId,
  styleName,
  petName,
  offer,
  styleImage,
  formatWidth,
  formatHeight,
  onRetry,
  retrying = false,
  retryError,
  onTryAnotherStyle,
}: IAGeneratingStepProps) {
  const { status, imageUrl } = useGenerationStatus(generationId);
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const router = useRouter();
  const { isGuest, isAdmin } = useAuth();
  // Saldo para "Prueba otros estilos" (null para el invitado o mientras carga).
  const { balance } = useCredits();

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

  const name = petName?.trim();
  const eyebrow = isRevealing ? "Tu retrato está listo" : "Vista previa gratis";
  const title = isRevealing
    ? name
      ? `¡Así quedó ${name}!`
      : "¡Así quedó tu retrato!"
    : isFailed
      ? "Algo no salió bien"
      : name
        ? `Creando el retrato de ${name}`
        : "Creando tu retrato";

  // Precio y anticipo (70/30) de la oferta.
  const priceValue = offer ? Number.parseFloat(offer.price) || 0 : 0;
  const { deposit, balance: dueOnDelivery } = splitDeposit(priceValue);
  const money = (n: number) => formatPrice(n, offer?.currencyCode ?? "USD");

  const savedArtHref = generationId
    ? `/user/generations/${generationId}`
    : "/user/generations";

  // El invitado entra con Google y sigue al paso de estilo: su arte pasa a la
  // cuenta (mismo id si es nueva; fusionado si ya existía) y la mascota
  // conserva su id, así que el paso de foto la reutiliza. Sin handler, al
  // arte guardado. `useGoogleLogin` siempre llama al `onDone` del último render.
  const { signIn, pending: signingIn } = useGoogleSignIn({
    onDone: () =>
      onTryAnotherStyle ? onTryAnotherStyle() : router.push(savedArtHref),
  });

  // Con cuenta y sin saldo, volver a elegir estilo acabaría en el 402: se lleva
  // a conseguir vistas previas. El admin no gasta créditos. Saldo aún sin
  // cargar (null): se ofrece igual.
  const outOfPreviews = !isGuest && !isAdmin && balance !== null && balance < 1;
  const previewsText = outOfPreviews
    ? "Ya usaste tus vistas previas gratis. Consigue más para seguir probando."
    : isAdmin || balance === null
      ? "Crea otra versión de tu retrato con un estilo distinto."
      : balance === 1
        ? "Te queda 1 vista previa."
        : `Te quedan ${balance} vistas previas.`;

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

  const secondaryButton =
    "flex w-full items-center justify-center gap-3 rounded-xl border border-slate-dark/15 bg-white px-6 py-3.5 text-base font-bold text-slate-dark transition-all hover:border-slate-dark/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="grow flex flex-col bg-white">
      <section className="py-6 md:py-0 md:flex-1 md:flex md:items-center">
        <Container>
          {/* Escritorio: el arte ocupa las cuatro filas; título y contenido van
              en las dos del medio y las filas 1fr de los extremos los centran
              en vertical respecto al arte. */}
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 animate-in fade-in duration-700 md:grid-cols-2 md:grid-rows-[1fr_auto_auto_1fr] md:gap-x-14 md:gap-y-6">
            {/* Título: primero en móvil; en escritorio, arriba de la columna
                derecha. */}
            <header className="flex flex-col gap-1 md:col-start-2 md:row-start-2 md:w-full md:max-w-md md:justify-self-center">
              <span
                className={`text-sm font-bold uppercase tracking-wider ${
                  isRevealing ? "text-green-700" : "text-text-muted"
                }`}
              >
                {eyebrow}
              </span>
              <h1 className="font-display text-3xl md:text-5xl font-black text-slate-dark tracking-tight leading-tight">
                {title}
              </h1>
            </header>

            <div className="md:col-start-1 md:row-start-1 md:row-span-4 md:flex md:items-center md:justify-center">
              <ResultArtwork
                image={displayImage}
                formatWidth={formatWidth}
                formatHeight={formatHeight}
                isGenerating={isGenerating}
                styleName={styleName}
              />
            </div>

            <div className="flex flex-col gap-5 md:col-start-2 md:row-start-3 md:w-full md:max-w-md md:justify-self-center">
              {isGenerating && (
                <p className="text-base leading-relaxed text-text-muted min-h-12">
                  <span
                    key={craftingMessage}
                    className="inline-block animate-in fade-in duration-700"
                  >
                    {craftingMessage}
                  </span>
                </p>
              )}

              {isRevealing && (
                <>
                  <div className={`flex flex-col gap-3 rounded-2xl p-4 ${SOFT_SURFACE}`}>
                    <div className="flex flex-col gap-1">
                      <span className="font-display text-lg font-bold text-slate-dark">
                        {isGuest ? "Prueba otros estilos gratis" : "Prueba otros estilos"}
                      </span>
                      <span className="text-sm leading-snug text-text-muted">
                        {isGuest
                          ? "Guarda este retrato en tu cuenta y crea 4 vistas previas más, sin costo."
                          : previewsText}
                      </span>
                    </div>

                    {isGuest ? (
                      <button
                        type="button"
                        onClick={signIn}
                        disabled={signingIn}
                        aria-busy={signingIn}
                        className={secondaryButton}
                      >
                        {signingIn ? (
                          <span className="material-symbols-outlined animate-spin text-[20px]">
                            progress_activity
                          </span>
                        ) : (
                          <GoogleLogo />
                        )}
                        {signingIn ? "Abriendo Google…" : "Continuar con Google"}
                      </button>
                    ) : outOfPreviews ? (
                      <Link href="/credits" className={secondaryButton}>
                        <span className="material-symbols-outlined text-[20px]">
                          add_circle
                        </span>
                        Conseguir vistas previas
                      </Link>
                    ) : onTryAnotherStyle ? (
                      <button
                        type="button"
                        onClick={onTryAnotherStyle}
                        className={secondaryButton}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          palette
                        </span>
                        Elegir otro estilo
                      </button>
                    ) : null}

                    {!isGuest && (
                      <p className="text-center text-sm text-text-muted">
                        Tu retrato ya está guardado ·{" "}
                        <Link
                          href={savedArtHref}
                          className="font-bold text-slate-dark underline underline-offset-4"
                        >
                          Ver en mi cuenta
                        </Link>
                      </p>
                    )}
                  </div>

                  <div aria-hidden="true" className="h-px bg-slate-dark/10" />

                  <span className="font-display text-xl font-bold text-slate-dark">
                    Rompecabezas de madera
                  </span>

                  {offer ? (
                    <>
                      {priceValue > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-slate-dark/10">
                          <div
                            className={`flex items-center justify-between px-4 py-3 ${SOFT_SURFACE}`}
                          >
                            <span className="text-base font-bold text-slate-dark">
                              Total
                            </span>
                            <span className="font-display text-2xl font-black text-slate-dark">
                              {money(priceValue)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-slate-dark/10 border-t border-slate-dark/10">
                            <div className="flex flex-col gap-0.5 px-4 py-3">
                              <span className="text-sm text-text-muted">
                                Pagas hoy
                              </span>
                              <span className="font-display text-xl font-black text-slate-dark">
                                {money(deposit)}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 px-4 py-3">
                              <span className="text-sm text-text-muted">
                                Al recibirlo
                              </span>
                              <span className="font-display text-xl font-black text-slate-dark">
                                {money(dueOnDelivery)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void order()}
                        disabled={isCheckingOut}
                        aria-busy={isCheckingOut}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCheckingOut ? "Abriendo el pago…" : "Pedir mi rompecabezas"}
                        <span
                          className={`material-symbols-outlined text-[20px] ${
                            isCheckingOut ? "animate-spin" : ""
                          }`}
                        >
                          {isCheckingOut ? "progress_activity" : "arrow_forward"}
                        </span>
                      </button>

                      {checkoutError && (
                        <p className="text-sm text-red-600">{checkoutError}</p>
                      )}

                      <div className="flex flex-col gap-2">
                        {priceValue > 0 && (
                          <p className="flex items-start gap-2 text-sm font-bold text-green-700">
                            <span
                              aria-hidden="true"
                              className="material-symbols-outlined text-[18px]"
                            >
                              verified_user
                            </span>
                            El resto lo pagas cuando lo tengas en tus manos.
                          </p>
                        )}
                        <p className="flex items-start gap-2 text-sm text-text-muted">
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[18px]"
                          >
                            local_shipping
                          </span>
                          Lo fabricamos en 3 días y te llega en 3 a 7 días, a
                          todo Ecuador.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-text-muted">
                      {isGuest
                        ? "Guárdalo con tu cuenta de Google para pedirlo impreso más adelante."
                        : "Tu arte quedó guardado en tu cuenta. Pronto podrás pedirlo impreso desde ahí."}
                    </p>
                  )}
                </>
              )}

              {isFailed && (
                <>
                  <p className="text-base leading-relaxed text-text-muted">
                    Hubo un problema al crear tu arte. Vuelve a intentarlo.
                  </p>
                  {onRetry && (
                    <div className="flex w-full flex-col gap-3">
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
                </>
              )}
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
