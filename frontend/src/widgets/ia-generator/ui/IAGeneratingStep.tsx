"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { GoogleLogo } from "@/shared/ui/GoogleLogo";
import { useCredits } from "@/hooks/useCredits";
import { Container } from "@/shared/ui/Container";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import type { CartItem } from "@/context/CartContext";
import { formatPrice } from "@/entities/product/lib/variantPresentation";
import { splitDeposit } from "@/entities/product/lib/deposit";
import { bundlePrice, type BundleQuantity } from "@/entities/product/lib/bundle";
import { trackEvent } from "@/shared/lib/analytics/track";
import { generateArtEvent } from "@/shared/lib/analytics/events";
import { CRAFTING_MESSAGES } from "../model/crafting-messages";
import { useBundleOrder, type BundleSlot } from "../model/bundleOrder";
import { BundleOrderPanel } from "./BundleOrderPanel";

/** Fondo cálido de las superficies secundarias (fila del total, "¿Aún no…?"). */
const SOFT_SURFACE = "bg-[#F5F3EE]";

/** Lo que se vende al terminar la vista previa: una variante ya resuelta. */
export interface PuzzleOffer {
  productTitle: string;
  productImage: string;
  formatLabel: string;
  variantId: string;
  price: string;
  /** Precio de referencia tachado ($100); se multiplica por la cantidad. */
  compareAtPrice?: string | null;
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
  /** Cantidad preseleccionada en la landing (`qty`), si no hay pedido guardado. */
  initialQuantity?: BundleQuantity;
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
  initialQuantity = 1,
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

  // Pedido en armado del bundle: los retratos apartados antes (sin este) y la
  // cantidad elegida, que nunca baja de apartados + este.
  const bundle = useBundleOrder(initialQuantity);
  const keptSlots = bundle.slots.filter((s) => s.generationId !== generationId);
  const minQuantity = keptSlots.length + 1;
  const quantity = Math.max(bundle.quantity, minQuantity) as BundleQuantity;
  // Este retrato cuenta cuando ya se ve.
  const filled = keptSlots.length + (imageUrl ? 1 : 0);
  const needsMore = filled < quantity;

  // Precio del bundle y su anticipo (70/30) sobre el total con descuento.
  const priceValue = offer ? Number.parseFloat(offer.price) || 0 : 0;
  const pricing = bundlePrice(priceValue, quantity);
  const { deposit, balance: dueOnDelivery } = splitDeposit(pricing.total);
  const compareAtTotal =
    (offer?.compareAtPrice ? Number.parseFloat(offer.compareAtPrice) || 0 : 0) *
    quantity;
  // Como en la ficha: el ahorro se redondea hacia abajo a dólares enteros.
  const savings =
    compareAtTotal > pricing.total ? Math.floor(compareAtTotal - pricing.total) : 0;
  const money = (n: number) =>
    formatPrice(n, offer?.currencyCode ?? "USD", { trimZeroCents: true });

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

  const currentSlot: BundleSlot | null =
    offer && generationId && imageUrl
      ? {
          generationId,
          imageUrl,
          styleName,
          variantId: offer.variantId,
          petName: petName?.trim() || null,
        }
      : null;

  // Aparta este retrato y va a crear el siguiente. El invitado entra antes con
  // Google: el popup tiene que abrirse en el mismo click, y su `onDone` sigue
  // al paso de estilo. Si cierra el popup, este retrato queda apartado y vuelve
  // a aparecer aquí sin duplicarse.
  const addAnother = () => {
    if (!currentSlot) return;
    bundle.keep(currentSlot, quantity);
    if (isGuest) signIn();
    else onTryAnotherStyle?.();
  };

  const order = async () => {
    if (!offer || !currentSlot) return;
    setCheckoutError(null);
    // Una línea de 1 por retrato: Shopify suma las unidades del producto y
    // aplica el descuento por cantidad. `price` ya es el unitario con
    // descuento, para que InitiateCheckout lleve el total real.
    const items: CartItem[] = [...keptSlots, currentSlot].map((slot) => ({
      id: slot.generationId,
      variantId: slot.variantId,
      name: offer.productTitle,
      size: offer.formatLabel,
      style: slot.styleName ?? undefined,
      price: pricing.unitPrice,
      quantity: 1,
      img: offer.productImage,
      // _generation_id + _image_url viajan como attributes de la línea: el
      // webhook de órdenes los usa para asociar el arte al pedido.
      generationId: slot.generationId,
      imageUrl: slot.imageUrl,
    }));
    const result = await startCheckout(items);
    if (result.status === "redirect") {
      bundle.clear();
      return;
    }
    setCheckoutError(
      result.message ??
        "No pudimos iniciar el pago. Inténtalo de nuevo en un momento.",
    );
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
                        {quantity > 1
                          ? "¿Otro estilo para este retrato?"
                          : isGuest
                            ? "Prueba otros estilos gratis"
                            : "Prueba otros estilos"}
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
                        <BundleOrderPanel
                          quantity={quantity}
                          onQuantityChange={bundle.setQuantity}
                          minQuantity={minQuantity}
                          unitPrice={priceValue}
                          formatMoney={money}
                          keptSlots={keptSlots}
                          currentImage={imageUrl}
                          onRemove={bundle.remove}
                        />
                      )}

                      {priceValue > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-slate-dark/10">
                          <div
                            className={`flex items-center justify-between gap-3 px-4 py-3 ${SOFT_SURFACE}`}
                          >
                            <span className="text-base font-bold text-slate-dark">
                              Total
                            </span>
                            <span className="flex items-baseline gap-2">
                              {savings > 0 && (
                                <span className="text-base font-medium text-text-muted/70 line-through">
                                  {money(compareAtTotal)}
                                </span>
                              )}
                              <span className="font-display text-2xl font-black text-slate-dark">
                                {money(pricing.total)}
                              </span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-slate-dark/10 border-t border-slate-dark/10">
                            <div className="flex flex-col gap-0.5 px-4 py-3">
                              <span className="text-sm text-text-muted">
                                Hoy, para empezar
                              </span>
                              <span className="font-display text-xl font-black text-slate-dark">
                                {money(deposit)}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 px-4 py-3">
                              <span className="text-sm text-text-muted">
                                Al recibir, en efectivo
                              </span>
                              <span className="font-display text-xl font-black text-slate-dark">
                                {money(dueOnDelivery)}
                              </span>
                            </div>
                          </div>
                          {savings > 0 && (
                            <p className="flex items-center gap-2 border-t border-slate-dark/10 px-4 py-2.5 text-sm font-bold text-green-700">
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[18px]"
                              >
                                local_shipping
                              </span>
                              Envío gratis · ahorras {money(savings)}
                            </p>
                          )}
                        </div>
                      )}

                      {needsMore && !isGuest && outOfPreviews ? (
                        // Sin vistas previas: se aparta este retrato y se van a
                        // conseguir más. El pedido sigue guardado al volver.
                        <Link
                          href="/credits"
                          onClick={() => currentSlot && bundle.keep(currentSlot, quantity)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
                        >
                          Consigue vistas previas para el retrato {filled + 1}
                          <span className="material-symbols-outlined text-[20px]">
                            arrow_forward
                          </span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (needsMore ? addAnother() : void order())}
                          disabled={isCheckingOut || signingIn}
                          aria-busy={isCheckingOut || signingIn}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isCheckingOut
                            ? "Abriendo el pago…"
                            : signingIn
                              ? "Abriendo Google…"
                              : needsMore
                                ? `Crear el retrato ${filled + 1}`
                                : quantity === 1
                                  ? "Pedir mi rompecabezas"
                                  : `Pedir mis ${quantity} rompecabezas`}
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              isCheckingOut || signingIn ? "animate-spin" : ""
                            }`}
                          >
                            {isCheckingOut || signingIn
                              ? "progress_activity"
                              : needsMore
                                ? "add"
                                : "arrow_forward"}
                          </span>
                        </button>
                      )}

                      {needsMore && (
                        <p className="-mt-2 text-center text-sm text-text-muted">
                          {isGuest
                            ? "Entra con Google: guardamos este retrato y te damos 4 vistas previas más."
                            : "Apartamos este retrato. Elige el estilo del siguiente, para la misma mascota u otra."}
                        </p>
                      )}

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
