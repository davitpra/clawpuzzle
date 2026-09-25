"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
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
  type SelectedProductInfo,
} from "@/widgets/ia-generator";
import { useCreateGeneration } from "@/widgets/ia-generator/model/useCreateGeneration";
import type { Pet } from "@/widgets/ia-generator/ui/upload-step/types";

import { getFormatPhysicalSize } from "@/entities/product/lib/formatPhysicalSize";
import { normalizeTemplate } from "@/entities/product/lib/template";
import { useStyle } from "@/hooks/useStyle";
import { useFormatOptions } from "@/hooks/useFormatOptions";
import { useGenerateImage, type GeneratePayload } from "@/hooks/useGenerateImage";
import { useCredits } from "@/hooks/useCredits";
import { useCart } from "@/context/CartContext";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { clearDraft, loadDraft, saveDraft } from "@/shared/lib/create-draft";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

const PRODUCT_LOAD_ERROR =
  "We couldn't load this product. Please pick it again from the catalog.";
const STYLE_CONTEXT_ERROR =
  "This style is not connected to an available digital product yet.";

// Flujo clásico (entrada desde una ficha de producto): el producto, el formato y
// el estilo ya vienen resueltos, así que aquí solo queda la sesión, la foto y el
// resultado.
const STEP_LEAD = 1;
const STEP_UPLOAD = 2;
const STEP_THANKS = 3;

// Flujo de lanzamiento (entrada desde la landing con un estilo): la foto va antes
// que la cuenta, para que el visitante invierta algo antes de registrarse.
const STEP_PHOTO = 1;
const STEP_ACCOUNT = 2;
const STEP_GENERATING = 3;

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
          | { data: StyleCompatResponse }
          | StyleCompatResponse;
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
        actionLabel="Back to styles"
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
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const searchParams = useSearchParams();

  const productRefId = searchParams.get("product_ref_id");
  const formatId = searchParams.get("format_id");
  const styleId = searchParams.get("style_id");
  const selectionsFromUrl = searchParams.get("selections");

  // El generador es una ruta de continuación: sin el contexto completo del
  // producto no hay nada que generar y no se dispara ningún fetch.
  const hasProductContext = !!(productRefId && formatId && styleId);
  const hasStyleOnly = !!styleId && !productRefId && !formatId;

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
  // La especie viaja al VLM dentro de `petContext`, así que no es un default
  // inocuo: se pregunta en el paso de foto.
  const [species, setSpecies] = useState("dog");
  const [activePet, setActivePet] = useState<Pet | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

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

  useEffect(() => {
    if (!hasProductContext) return;
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
  }, [hasProductContext, productRefId]);

  const {
    formats,
    product: shopifyProduct,
    template,
    isLoading: isLoadingFormats,
    error: formatsError,
  } = useFormatOptions(resolvedHandle);

  const productInfo: SelectedProductInfo | null = useMemo(() => {
    if (!formatId || !shopifyProduct || formats.length === 0) return null;
    const f = formats.find((x) => x.formatId === formatId);
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
  }, [formats, shopifyProduct, formatId, template]);

  // El paso de upload clásico solo se muestra con `productInfo` ya resuelto: si
  // se enviara antes, no habría variante y el producto físico nunca entraría al
  // carrito. El flujo de lanzamiento no lo espera: su producto siempre es el
  // digital, que no va al carrito, y bloquear ahí solo añadiría dos viajes de red
  // (backend + Shopify) en la puerta principal del embudo.
  const isResolvingProduct =
    !productLookupError && (!resolvedHandle || isLoadingFormats);

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
        setSpecies(draft.species);
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
      void saveDraft({ styleId, petName, species, files: photos });
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draftLoaded, styleId, photos, petName, species]);

  // ---- Envío del flujo de lanzamiento -----------------------------------

  const runSubmit = useCallback(async () => {
    if (!productRefId || !formatId || !styleId) return;
    try {
      const result = await submit({
        photos,
        form: {
          name: petName,
          species,
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
    species,
    activePet,
    productRefId,
    formatId,
    styleId,
    userSelections,
    productInfo,
    style,
  ]);

  const handlePhotoContinue = useCallback(() => {
    resetSubmitError();
    // Con el estado de sesión aún sin resolver no se puede decidir si toca el
    // paso de cuenta; el botón vuelve a quedar disponible enseguida.
    if (isAuthLoading) return;
    if (isAuthenticated) void runSubmit();
    else setStep(STEP_ACCOUNT);
  }, [isAuthLoading, isAuthenticated, runSubmit, resetSubmitError]);

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
          : "Couldn't retry. Please try again.",
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

  // La barra de progreso cuenta solo los pasos que el usuario va a ver: con
  // sesión abierta el de cuenta no existe.
  const launchSteps = isAuthenticated
    ? [STEP_PHOTO, STEP_GENERATING]
    : [STEP_PHOTO, STEP_ACCOUNT, STEP_GENERATING];
  const headerStep = LAUNCH_MODE
    ? Math.max(launchSteps.indexOf(step) + 1, 1)
    : step;
  const headerTotal = LAUNCH_MODE ? launchSteps.length : 3;

  return (
    <div className="bg-white text-slate-dark font-body min-h-screen flex flex-col transition-all duration-500">
      <IAHeader
        step={hasProductContext ? headerStep : 0}
        totalSteps={headerTotal}
      />

      {hasStyleOnly ? (
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
              styleImg={style?.img ?? null}
              photos={photos}
              onPhotosChange={setPhotos}
              petName={petName}
              onPetNameChange={setPetName}
              species={species}
              onSpeciesChange={setSpecies}
              activePet={activePet}
              onSelectPet={setActivePet}
              onContinue={handlePhotoContinue}
              onChangeStyle={() => void clearDraft()}
              submitting={submitting}
              error={submitError}
              outOfCredits={outOfCredits}
            />
          )}

          {step === STEP_ACCOUNT && (
            <IALeadStep
              registerTitle="Create a free account"
              registerSubtitle="5 free artworks included — your photo is ready to go."
              onComplete={() => void runSubmit()}
            />
          )}

          {step === STEP_GENERATING && (
            <IAGeneratingStep
              generationId={generationId}
              styleId={styleId}
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
