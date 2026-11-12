"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  IAHeader,
  IAUploadStep,
  IALeadStep,
  IAThanksStep,
  IAPhotoStep,
  IAGeneratingStep,
  IAStartFromProduct,
  IAStyleStep,
  type SelectedProductInfo,
  type PuzzleOffer,
} from "@/widgets/ia-generator";
import { useCreateGeneration } from "@/widgets/ia-generator/model/useCreateGeneration";
import type { Pet } from "@/widgets/ia-generator/ui/upload-step/types";

import { getFormatPhysicalSize } from "@/entities/product/lib/formatPhysicalSize";
import { normalizeTemplate } from "@/entities/product/lib/template";
import { isDogVariant } from "@/entities/product/lib/variantOptions";
import { useStyle } from "@/hooks/useStyle";
import { useFormatOptions } from "@/hooks/useFormatOptions";
import { pickOfferVariant } from "@/widgets/ia-generator/model/offerVariant";
import {
  useGenerateImage,
  type GeneratePayload,
} from "@/hooks/useGenerateImage";
import { useCredits } from "@/hooks/useCredits";
import { useCart } from "@/context/CartContext";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { clearDraft, loadDraft, saveDraft } from "@/shared/lib/create-draft";
import { TURNSTILE_SITE_KEY } from "@/shared/config/guest";
import { getTurnstileToken } from "@/shared/lib/turnstile";
import { trackEvent } from "@/shared/lib/analytics/track";
import { uploadPhotoEvent } from "@/shared/lib/analytics/events";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

const PRODUCT_LOAD_ERROR =
  "No pudimos cargar este producto. Vuelve a elegirlo desde el inicio.";
const STYLE_CONTEXT_ERROR =
  "Este estilo todavía no está disponible para rompecabezas.";

// Flujo clásico (entrada desde una ficha de producto): el producto, el formato y
// el estilo ya vienen resueltos, así que aquí solo queda la sesión, la foto y el
// resultado.
const STEP_LEAD = 1;
const STEP_UPLOAD = 2;
const STEP_THANKS = 3;

// Flujo de lanzamiento (entrada desde la landing con un estilo): la foto va antes
// que la cuenta, para que el visitante invierta algo antes de registrarse. Sin
// sesión, la primera imagen se genera con una sesión de invitado y el paso de
// cuenta se salta; solo aparece si el backend no concede esa sesión (apagada,
// tope diario, captcha).
const STEP_PHOTO = 1;
const STEP_ACCOUNT = 2;
const STEP_GENERATING = 3;
// Desde la ficha del producto el estilo se elige en `/create` (paso de estilo,
// derivado de la URL: no es un valor de `step`). En la barra de progreso
// cuenta siempre como el primer paso del flujo de lanzamiento.
const STYLE_STEP_COUNT = 1;

// Espera antes de persistir el borrador, para no escribir en cada pulsación.
const DRAFT_DEBOUNCE_MS = 500;

interface StyleCompatResponse {
  defaultCreateContext: {
    productRefId: string;
    formatId: string;
  } | null;
}

function StyleFirstResolver({
  styleId,
  selections,
}: {
  styleId: string;
  selections: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/styles/${encodeURIComponent(styleId)}/compat`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("compat_request_failed");
        const json = (await response.json()) as
          { data: StyleCompatResponse } | StyleCompatResponse;
        return "data" in json ? json.data : json;
      })
      .then((compat) => {
        if (!compat.defaultCreateContext) {
          setError(STYLE_CONTEXT_ERROR);
          return;
        }

        const params = new URLSearchParams({
          style_id: styleId,
          product_ref_id: compat.defaultCreateContext.productRefId,
          format_id: compat.defaultCreateContext.formatId,
        });
        if (selections) params.set("selections", selections);
        router.replace(`/create?${params.toString()}`);
      })
      .catch((requestError: unknown) => {
        if ((requestError as Error).name !== "AbortError") {
          setError(STYLE_CONTEXT_ERROR);
        }
      });

    return () => controller.abort();
  }, [router, selections, styleId]);

  if (error) {
    return (
      <IAStartFromProduct
        message={error}
        actionHref="/#styles"
        actionLabel="Volver a los estilos"
      />
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-4xl text-primary">
        progress_activity
      </span>
    </div>
  );
}

function IAGeneratorContent() {
  const router = useRouter();
  const {
    isAuthenticated,
    hasSession,
    isLoading: isAuthLoading,
    startGuestSession,
  } = useAuth();
  const searchParams = useSearchParams();

  const productRefId = searchParams.get("product_ref_id");
  const formatId = searchParams.get("format_id");
  const styleId = searchParams.get("style_id");
  // Variante que el cliente eligió en la ficha (p. ej. tema Perro | Gato).
  // Varias variantes comparten formato, así que `format_id` no basta.
  const variantId = searchParams.get("variant_id");
  const selectionsFromUrl = searchParams.get("selections");

  // El generador es una ruta de continuación: sin el contexto completo del
  // producto no hay nada que generar y no se dispara ningún fetch.
  const hasProductContext = !!(productRefId && formatId && styleId);
  const hasStyleOnly = !!styleId && !productRefId && !formatId;
  // Llegada desde la ficha del producto: hay producto y formato, falta estilo.
  const needsStyle = !!(productRefId && formatId && !styleId);

  const {
    style,
    isLoading: isLoadingStyle,
    error: styleError,
  } = useStyle(hasProductContext ? styleId : null);

  const [step, setStep] = useState(LAUNCH_MODE ? STEP_PHOTO : STEP_LEAD);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  // Payload de la última generación disparada: permite reintentar desde la
  // pantalla de espera sin volver al paso de foto.
  const [lastPayload, setLastPayload] = useState<GeneratePayload | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Estado propio del flujo de lanzamiento.
  const [petName, setPetName] = useState("");
  const [activePet, setActivePet] = useState<Pet | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  // Sesión de invitado en curso (captcha + POST /auth/guest).
  const [startingGuest, setStartingGuest] = useState(false);
  // El backend no concedió la sesión de invitado: se vuelve al paso de cuenta.
  const [guestUnavailable, setGuestUnavailable] = useState(false);
  // Contenedor del widget de Turnstile; solo se ve si Cloudflare pide un clic.
  const turnstileRef = useRef<HTMLDivElement>(null);

  const { generate } = useGenerateImage();
  const { refresh: refreshCredits } = useCredits();
  const { addToCart, removeItem } = useCart();
  const {
    submit,
    submitting,
    error: submitError,
    outOfCredits,
    reset: resetSubmitError,
  } = useCreateGeneration();

  // Con sesión abierta el paso de login sobra. Se decide una sola vez, cuando
  // el estado de auth ya resolvió: así un refresh de token a mitad del upload
  // no devuelve al usuario al login y le borra las fotos cargadas.
  useEffect(() => {
    if (bootstrapped || isAuthLoading) return;
    if (isAuthenticated && !LAUNCH_MODE) setStep(STEP_UPLOAD);
    setBootstrapped(true);
  }, [bootstrapped, isAuthLoading, isAuthenticated]);

  // Las opciones del estilo (`templateVarOptions`) se eligen en la ficha del
  // producto y llegan serializadas en `selections`. Si la URL no las trae —una
  // URL armada a mano, o la landing en lanzamiento—, se cae a los valores por
  // defecto del estilo.
  const userSelections = useMemo<Record<string, string | number>>(() => {
    if (selectionsFromUrl) {
      try {
        const parsed = JSON.parse(selectionsFromUrl) as Record<string, unknown>;
        const result: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" || typeof v === "number") result[k] = v;
        }
        if (Object.keys(result).length > 0) return result;
      } catch {
        // Selections inválidas: se ignoran y se usan los defaults del estilo.
      }
    }
    const defaults: Record<string, string | number> = {};
    if (style?.templateVarOptions) {
      for (const [key, opt] of Object.entries(style.templateVarOptions)) {
        if (opt.default !== undefined) defaults[key] = opt.default;
      }
    }
    return defaults;
  }, [selectionsFromUrl, style]);

  // El deep-link trae el id interno del producto; para leer precio, imagen y
  // tamaño físico hace falta el handle de Shopify.
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null);
  const [productLookupError, setProductLookupError] = useState<string | null>(
    null,
  );

  // En el paso de estilo también: la variante (Perro | Gato) decide qué imagen
  // enseñan las cards.
  useEffect(() => {
    if (!hasProductContext && !needsStyle) return;
    let cancelled = false;
    fetch(`${API_URL}/products/${productRefId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = "data" in json ? json.data : json;
        const handle = (data as { shopifyHandle?: string })?.shopifyHandle;
        if (handle) setResolvedHandle(handle);
        else setProductLookupError(PRODUCT_LOAD_ERROR);
      })
      .catch(() => {
        if (!cancelled) setProductLookupError(PRODUCT_LOAD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [hasProductContext, needsStyle, productRefId]);

  const {
    formats,
    product: shopifyProduct,
    template,
    isLoading: isLoadingFormats,
    error: formatsError,
  } = useFormatOptions(resolvedHandle);

  const productInfo: SelectedProductInfo | null = useMemo(() => {
    if (!formatId || !shopifyProduct || formats.length === 0) return null;
    const f =
      formats.find(
        (x) => x.formatId === formatId && x.shopifyVariantId === variantId,
      ) ?? formats.find((x) => x.formatId === formatId);
    if (!f) return null;
    const physicalSize = getFormatPhysicalSize(
      shopifyProduct,
      f.shopifyVariantId,
    );
    return {
      shopifyVariantId: f.shopifyVariantId,
      price: f.price,
      currencyCode: f.currencyCode,
      productTitle: shopifyProduct.title,
      productImage: shopifyProduct.images.edges[0]?.node.url ?? "",
      formatLabel: f.displayName,
      template,
      formatWidth: physicalSize?.width ?? null,
      formatHeight: physicalSize?.height ?? null,
    };
  }, [formats, shopifyProduct, formatId, variantId, template]);

  // Oferta del paso final de lanzamiento: una sola variante, sin volver a
  // preguntar. La que llegó desde la ficha si sigue disponible; si no, la
  // primera disponible del formato.
  const puzzleOffer: PuzzleOffer | null = useMemo(() => {
    if (!productInfo) return null;
    const chosen = pickOfferVariant(formats, formatId, variantId);
    if (!chosen) return null;
    return {
      productTitle: productInfo.productTitle,
      productImage: productInfo.productImage,
      formatLabel: productInfo.formatLabel,
      variantId: chosen.shopifyVariantId,
      price: chosen.price,
      currencyCode: chosen.currencyCode,
    };
  }, [productInfo, formats, formatId, variantId]);

  // El paso de upload clásico solo se muestra con `productInfo` ya resuelto: si
  // se enviara antes, no habría variante y el producto físico nunca entraría al
  // carrito. El flujo de lanzamiento no lo espera: su producto siempre es el
  // digital, que no va al carrito, y bloquear ahí solo añadiría dos viajes de red
  // (backend + Shopify) en la puerta principal del embudo.
  const isResolvingProduct =
    !productLookupError && (!resolvedHandle || isLoadingFormats);

  // Tema elegido en la ficha, para las cards del paso de estilo y la imagen del
  // estilo de los pasos siguientes. Mientras se resuelve el producto se espera,
  // para no pasar de la imagen de Gato a la de Perro delante del visitante.
  const isDogTheme = isDogVariant(
    shopifyProduct?.variants.edges.find((e) => e.node.id === variantId)?.node,
  );
  const isResolvingTheme =
    !!variantId && !shopifyProduct && !productLookupError && !formatsError;
  const isThemeLoading = needsStyle && isResolvingTheme;
  const styleImg = isResolvingTheme
    ? null
    : ((isDogTheme ? style?.dogImg : null) ?? style?.img ?? null);

  const productError =
    productLookupError ??
    formatsError ??
    (!isResolvingProduct && !productInfo ? PRODUCT_LOAD_ERROR : null);

  // ---- Borrador local (solo lanzamiento) --------------------------------

  // Restaura la foto tras una recarga o un cierre accidental. Solo si el
  // borrador es de este mismo estilo: cambiar de estilo empieza de cero.
  useEffect(() => {
    if (!LAUNCH_MODE || draftLoaded || !styleId) return;
    let cancelled = false;
    void loadDraft().then((draft) => {
      if (cancelled) return;
      if (draft && draft.styleId === styleId) {
        setPhotos(draft.files);
        setPetName(draft.petName);
      }
      setDraftLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftLoaded, styleId]);

  useEffect(() => {
    if (!LAUNCH_MODE || !draftLoaded || !styleId) return;
    if (photos.length === 0 && !petName.trim()) return;
    const timeout = setTimeout(() => {
      void saveDraft({ styleId, petName, files: photos });
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draftLoaded, styleId, photos, petName]);

  // ---- Envío del flujo de lanzamiento -----------------------------------

  const runSubmit = useCallback(async () => {
    if (!productRefId || !formatId || !styleId) return;
    try {
      const result = await submit({
        photos,
        form: {
          name: petName,
          // Raza y edad se editan luego desde /user: en la puerta principal cada
          // campo extra antes del registro es fricción.
          breed: "",
          age: "",
        },
        activePet,
        productRefId,
        formatId,
        styleId,
        userSelections,
        productInfo,
        styleName: style?.name ?? null,
      });

      void clearDraft();
      setActivePet(result.pet);
      setGenerationId(result.generationId);
      setLastPayload(result.payload);
      setStep(STEP_GENERATING);
    } catch {
      // El mensaje ya está en `submitError`; se muestra en el paso de foto.
      setStep(STEP_PHOTO);
    }
  }, [
    submit,
    photos,
    petName,
    activePet,
    productRefId,
    formatId,
    styleId,
    userSelections,
    productInfo,
    style,
  ]);

  // Imagen gratis sin login: captcha (si hay site key) y sesión de invitado.
  // Devuelve false si el backend no la concede.
  const openGuestSession = useCallback(async (): Promise<boolean> => {
    setStartingGuest(true);
    try {
      const token =
        TURNSTILE_SITE_KEY && turnstileRef.current
          ? await getTurnstileToken(turnstileRef.current, TURNSTILE_SITE_KEY)
          : undefined;
      await startGuestSession(token);
      return true;
    } catch (error) {
      console.warn("Guest session unavailable:", error);
      setGuestUnavailable(true);
      return false;
    } finally {
      setStartingGuest(false);
    }
  }, [startGuestSession]);

  const handlePhotoContinue = useCallback(async () => {
    resetSubmitError();
    // Con el estado de sesión aún sin resolver no se puede decidir si toca el
    // paso de cuenta; el botón vuelve a quedar disponible enseguida.
    if (isAuthLoading || startingGuest) return;
    trackEvent(uploadPhotoEvent(style?.name ?? null, !isAuthenticated));
    if (hasSession) {
      void runSubmit();
      return;
    }
    if (!guestUnavailable && (await openGuestSession())) {
      void runSubmit();
      return;
    }
    setStep(STEP_ACCOUNT);
  }, [
    isAuthLoading,
    startingGuest,
    isAuthenticated,
    hasSession,
    guestUnavailable,
    openGuestSession,
    runSubmit,
    resetSubmitError,
    style,
  ]);

  // Reintenta la generación fallida con el mismo payload, sin salir de la
  // pantalla de resultado. Un nuevo generationId reinicia el polling.
  const handleRetry = async () => {
    if (!lastPayload) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const g = await generate(lastPayload);
      // La generación consumió 1 crédito: refrescamos el saldo del badge.
      void refreshCredits();

      // Producto físico: el item del carrito referenciaba el generationId que
      // falló. Lo reemplazamos por el nuevo (mismo variantId) para que checkout
      // y updateItemImage apunten a la generación buena. Digital no va al
      // carrito, así que se omite.
      const isDigital = normalizeTemplate(productInfo?.template) === "Digital";
      if (productInfo && !isDigital) {
        removeItem(productInfo.shopifyVariantId);
        addToCart({
          id: g.id,
          variantId: productInfo.shopifyVariantId,
          name: productInfo.productTitle,
          size: productInfo.formatLabel,
          style: style?.name ?? undefined,
          price: parseFloat(productInfo.price),
          quantity: 1,
          img: productInfo.productImage,
          generationId: g.id,
        });
      }

      setGenerationId(g.id);
    } catch (err) {
      setRetryError(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo reintentar. Inténtalo de nuevo.",
      );
    } finally {
      setRetrying(false);
    }
  };

  // El flujo de lanzamiento no espera al producto de Shopify (ver arriba) y no
  // deja que un fallo de ese fetch corte el embudo: su producto es el digital.
  const isBootstrapping = LAUNCH_MODE
    ? !bootstrapped || isLoadingStyle || !draftLoaded
    : !bootstrapped || isLoadingStyle || isResolvingProduct || !productInfo;

  const blockingError = LAUNCH_MODE ? styleError : (productError ?? styleError);

  // La barra de progreso cuenta solo los pasos que el usuario va a ver: el de
  // cuenta solo existe si no hay sesión y el backend negó la de invitado.
  const launchSteps =
    hasSession || !guestUnavailable
      ? [STEP_PHOTO, STEP_GENERATING]
      : [STEP_PHOTO, STEP_ACCOUNT, STEP_GENERATING];
  const headerStep = LAUNCH_MODE
    ? needsStyle
      ? 1
      : Math.max(launchSteps.indexOf(step) + 1, 1) + STYLE_STEP_COUNT
    : step;
  const headerTotal = LAUNCH_MODE ? launchSteps.length + STYLE_STEP_COUNT : 3;

  // El producto y el formato se conservan: elegir o cambiar de estilo solo
  // toca `style_id` (las `selections` son de un estilo concreto y se sueltan).
  const productParams = new URLSearchParams();
  if (productRefId) productParams.set("product_ref_id", productRefId);
  if (formatId) productParams.set("format_id", formatId);
  if (variantId) productParams.set("variant_id", variantId);
  const styleStepHref = `/create?${productParams.toString()}`;

  const handleStyleSelect = (id: string) => {
    const params = new URLSearchParams(productParams);
    params.set("style_id", id);
    router.push(`/create?${params.toString()}`);
  };

  return (
    <div className="bg-white text-slate-dark font-body min-h-screen flex flex-col transition-all duration-500">
      <IAHeader
        step={hasProductContext || (needsStyle && LAUNCH_MODE) ? headerStep : 0}
        totalSteps={headerTotal}
      />

      {needsStyle ? (
        <IAStyleStep
          onSelect={handleStyleSelect}
          isDogTheme={isDogTheme}
          isThemeLoading={isThemeLoading}
        />
      ) : hasStyleOnly ? (
        <StyleFirstResolver styleId={styleId} selections={selectionsFromUrl} />
      ) : !hasProductContext ? (
        <IAStartFromProduct />
      ) : blockingError ? (
        <IAStartFromProduct message={blockingError} />
      ) : isBootstrapping ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      ) : LAUNCH_MODE ? (
        <>
          {step === STEP_PHOTO && (
            <IAPhotoStep
              styleName={style?.name ?? null}
              styleImg={styleImg}
              photos={photos}
              onPhotosChange={setPhotos}
              petName={petName}
              onPetNameChange={setPetName}
              activePet={activePet}
              onSelectPet={setActivePet}
              onContinue={() => void handlePhotoContinue()}
              onChangeStyle={() => void clearDraft()}
              changeStyleHref={styleStepHref}
              submitting={submitting || startingGuest}
              error={submitError}
              outOfCredits={outOfCredits}
            />
          )}
          {step === STEP_PHOTO && TURNSTILE_SITE_KEY && (
            <div ref={turnstileRef} className="flex justify-center pb-6" />
          )}

          {step === STEP_ACCOUNT && (
            <IALeadStep
              registerTitle="Crea tu cuenta gratis"
              registerSubtitle="Incluye 5 vistas previas gratis. Tu foto ya está lista."
              onComplete={() => void runSubmit()}
            />
          )}

          {step === STEP_GENERATING && (
            <IAGeneratingStep
              generationId={generationId}
              styleName={style?.name ?? null}
              offer={puzzleOffer}
              styleImage={styleImg}
              formatWidth={productInfo?.formatWidth ?? null}
              formatHeight={productInfo?.formatHeight ?? null}
              onRetry={lastPayload ? handleRetry : undefined}
              retrying={retrying}
              retryError={retryError}
            />
          )}
        </>
      ) : (
        <>
          {step === STEP_LEAD && (
            <IALeadStep onComplete={() => setStep(STEP_UPLOAD)} />
          )}

          {step === STEP_UPLOAD && productInfo && (
            <IAUploadStep
              photos={photos}
              onPhotosChange={setPhotos}
              styleId={styleId}
              productRefId={productRefId}
              formatId={formatId}
              onNext={(genId, payload) => {
                setGenerationId(genId);
                setLastPayload(payload);
                setStep(STEP_THANKS);
              }}
              productInfo={productInfo}
              styleName={style?.name ?? null}
              userSelections={userSelections}
            />
          )}

          {step === STEP_THANKS && productInfo && (
            <IAThanksStep
              generationId={generationId}
              productImage={productInfo.productImage}
              formatWidth={productInfo.formatWidth}
              formatHeight={productInfo.formatHeight}
              template={productInfo.template}
              onRetry={lastPayload ? handleRetry : undefined}
              retrying={retrying}
              retryError={retryError}
            />
          )}
        </>
      )}
    </div>
  );
}

// Componente principal de la página que utiliza Suspense para el manejo de carga diferida (Query Params)
export default function IAGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      }
    >
      <IAGeneratorContent />
    </Suspense>
  );
}
