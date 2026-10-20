"use client";

import { useState } from "react";
import { Container } from "@/shared/ui/Container";
import { useRouter } from "next/navigation";
import { toFrameStyle } from "@/entities/product/lib/frameStyle";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { useCart } from "@/context/CartContext";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { CRAFTING_MESSAGES } from "../model/crafting-messages";
import { FormatArtwork } from "./FormatArtwork";

interface IAThanksStepProps {
  generationId?: string | null;
  productImage?: string | null;
  formatWidth?: number | null;
  formatHeight?: number | null;
  template?: string | null;
  // Reintenta la generación fallida (re-dispara la petición en el padre). Sin
  // este handler no se muestra el botón de reintentar.
  onRetry?: () => void;
  retrying?: boolean;
  retryError?: string | null;
}

export function IAThanksStep({
  generationId,
  productImage,
  formatWidth,
  formatHeight,
  template,
  onRetry,
  retrying = false,
  retryError,
}: IAThanksStepProps) {
  const router = useRouter();

  // La presentación del cuadro (lienzo / póster / plano) se deriva del tipo de
  // producto, igual que en el resto de la app (ProductGallery, Hero, etc.).
  const frameStyle = toFrameStyle(template);
  // El arte "art" (sin producto físico) solo enlaza a la galería del usuario;
  // el rompecabezas va a checkout.
  const isArt = frameStyle === "art";

  // La petición de generación ya se disparó antes de llegar aquí; hacemos
  // polling hasta tener el resultado y lo mostramos en lugar del mockup.
  const { status, imageUrl } = useGenerationStatus(generationId ?? null);
  const displayImage = imageUrl ?? productImage;
  // Sin generationId no hay nada que esperar; en "failed" el mockup queda
  // estático (el copy ya cubre el fallback por email).
  const isGenerating = !!generationId && !imageUrl && status !== "failed";
  // En fallo ofrecemos reintentar en lugar de dejar los CTAs "cargando" para
  // siempre; el botón de reintentar solo aparece si el padre pasó onRetry.
  const isFailed = status === "failed";

  // Mientras se genera, la frase rota cada ~3s; al terminar mostramos el copy final
  // (o un fallback tranquilizador si la generación falló / se demoró).
  const craftingMessage = useRotatingMessage(CRAFTING_MESSAGES, {
    active: isGenerating,
  });
  const doneMessage =
    status === "failed"
      ? "Está tardando un poco más de lo normal. Te enviaremos tu arte por correo y quedará guardado en tu perfil."
      : "Tu arte está listo. Lo encontrarás siempre en tu perfil.";

  // Los CTAs de compra esperan a que la imagen generada aparezca en pantalla
  // (imageUrl del polling).
  const artReady = !!imageUrl;

  // El arte no-Digital ya se agregó al carrito en el paso de upload; solo
  // ofrecemos checkout cuando el carrito tiene items.
  const { cartCount } = useCart();
  const { startCheckout, isCheckingOut } = useShopifyCheckout();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Solo ofrecemos checkout/carrito cuando la imagen generada ya está lista
  // (artReady) y hay algo en el carrito.
  // En lanzamiento no se ofrece checkout aquí: la única venta es la de canvas al
  // descargar, y el "View Cart" de este bloque apunta a /cart, que el gate de
  // `proxy.ts` rebota a `/`.
  const showCheckout = !LAUNCH_MODE && !isArt && cartCount > 0 && artReady;

  const handleCheckout = async () => {
    setCheckoutError(null);
    const result = await startCheckout();
    if (result.status === "no-variants") {
      setCheckoutError(
        "Este producto aún no se puede pagar. Inténtalo desde tu carrito.",
      );
    } else if (result.status === "error") {
      setCheckoutError(
        result.message ?? "Algo salió mal. Inténtalo de nuevo.",
      );
    }
  };

  return (
    <main className="grow flex flex-col bg-white">
      <section>
        {/* Left — image, half screen */}
        <Container>
          <div className="flex-1 flex flex-col md:flex-row animate-in fade-in duration-700">
            <FormatArtwork
              image={displayImage ?? null}
              formatWidth={formatWidth}
              formatHeight={formatHeight}
              isGenerating={isGenerating}
            />

            {/* Right — text content, half screen */}
            <div className="w-full md:w-1/2 flex items-center justify-center px-10 py-14 bg-white">
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-5 max-w-sm w-full">
                <span className="material-symbols-outlined text-primary text-3xl">
                  favorite
                </span>

                <h1 className="font-display text-5xl md:text-6xl font-black text-slate-dark tracking-tight leading-none">
                  ¡Gracias!
                </h1>

                <div className="flex items-center gap-3 w-full justify-center md:justify-start">
                  <div className="h-px flex-1 max-w-30 bg-[#E0DED9]" />
                </div>

                <p className="text-slate-dark/70 text-base leading-relaxed min-h-12">
                  {isGenerating ? (
                    <span
                      key={craftingMessage}
                      className="inline-block animate-in fade-in duration-700"
                    >
                      {craftingMessage}
                    </span>
                  ) : (
                    doneMessage
                  )}
                </p>

                <div className="flex flex-col items-center gap-3 mt-2 w-full">
                  {isFailed && onRetry && (
                    <>
                      <button
                        onClick={onRetry}
                        disabled={retrying}
                        aria-busy={retrying}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-white px-6 py-3 text-sm font-bold transition-all shadow-sm hover:shadow-md hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm disabled:hover:bg-primary"
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
                        <p className="text-sm text-red-600 text-center">
                          {retryError}
                        </p>
                      )}
                    </>
                  )}

                  {isArt && (
                    <>
                      <button
                        onClick={() => router.push("/user/generations")}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-[#E0DED9] text-slate-dark hover:bg-gray-50 px-6 py-3 text-sm font-bold transition-all shadow-sm hover:shadow-md"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          brush
                        </span>
                        Ver todo mi arte
                      </button>
                    </>
                  )}

                  {showCheckout && (
                    <>
                      <button
                        onClick={handleCheckout}
                        disabled={isCheckingOut}
                        aria-busy={isCheckingOut}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-white px-6 py-3 text-sm font-bold transition-all shadow-sm hover:shadow-md hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm disabled:hover:bg-primary"
                      >
                        <span
                          className={`material-symbols-outlined text-[18px] ${
                            isCheckingOut ? "animate-spin" : ""
                          }`}
                        >
                          {isCheckingOut
                            ? "progress_activity"
                            : "shopping_cart_checkout"}
                        </span>
                        {isCheckingOut ? "Redirigiendo…" : "Ir a pagar"}
                      </button>
                      <button
                        onClick={() => router.push("/cart")}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-white px-6 py-3 text-sm font-bold transition-all shadow-sm hover:shadow-md hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm disabled:hover:bg-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          shopping_cart
                        </span>
                        Ver carrito
                      </button>
                      {checkoutError && (
                        <p className="text-sm text-red-600 text-center">
                          {checkoutError}
                        </p>
                      )}
                      <button
                        onClick={() => router.push("/user/generations")}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-[#E0DED9] text-slate-dark hover:bg-gray-50 px-6 py-3 text-sm font-bold transition-all shadow-sm hover:shadow-md"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          brush
                        </span>
                        Ver todo mi arte
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => router.push("/")}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-[#E0DED9] text-slate-dark hover:bg-gray-50 px-6 py-3 text-sm font-bold transition-all shadow-sm hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      storefront
                    </span>
                    Seguir comprando
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
