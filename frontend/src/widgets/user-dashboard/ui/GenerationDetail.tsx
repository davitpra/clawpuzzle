"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DetailErrorState } from "@/shared/ui/DetailErrorState";
import { DetailNotFound } from "@/shared/ui/DetailNotFound";
import { slugify } from "@/shared/lib/slug";
import { useGenerationDetail } from "@/entities/order/api/useGenerationDetail";
import { BackToGenerationsLink } from "@/entities/order/ui/BackToGenerationsLink";
import { GenerationImage } from "@/entities/order/ui/GenerationImage";
import { GenerationStatusBadge } from "@/entities/order/ui/GenerationStatusBadge";
import { formatOrderDate } from "@/entities/order/lib/presentation";
import {
  normalizeTemplate,
  templateLabel,
} from "@/entities/product/lib/template";
import { Carousel } from "@/shared/ui/Carousel";
import {
  GenerationProductCard,
  useGenerationProduct,
} from "@/features/generation-purchase";

interface Props {
  id: string;
}

/** File name for the downloaded artwork: `<style>-<pet name>.<ext>`. */
function buildDownloadName(
  styleName: string | null | undefined,
  petName: string | null | undefined,
  url: string | null | undefined,
) {
  const parts = [styleName, petName]
    .map((part) => (part ? slugify(part) : ""))
    .filter(Boolean);
  const base = parts.join("-") || "artwork";
  const extension = url
    ?.split("?")[0]
    .match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1];
  return `${base}.${extension?.toLowerCase() ?? "png"}`;
}

export function GenerationDetail({ id }: Props) {
  const router = useRouter();
  const {
    generation,
    isLoading,
    error,
    notFound,
    reload,
    deleting,
    deleteError,
    deleteGeneration,
  } = useGenerationDetail(id);

  // Producto para el que se pidió la obra. Con formato digital ya se entregó el
  // archivo, así que la card de compra sigue siendo el kit PBN y ni se resuelve
  // el producto; con formato físico se vende ese producto con la obra impresa.
  // Va antes de los early returns por las reglas de hooks.
  const isDigital =
    normalizeTemplate(generation?.productRef?.template) === "Digital";
  const sourceProduct = useGenerationProduct({
    productRefId: isDigital ? null : (generation?.productRef?.id ?? null),
    formatId: generation?.formatId,
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDelete() {
    const ok = await deleteGeneration();
    if (ok) router.push("/user/generations");
  }

  async function handleDownload(url: string, fileName: string) {
    setDownloading(true);
    try {
      // The image lives on a different origin, so `<a download>` is ignored:
      // fetch it as a blob to control the file name.
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div className="aspect-4/5 w-full animate-pulse rounded-xl bg-cream" />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="h-4 w-24 animate-pulse rounded bg-cream" />
          <div className="h-10 w-56 animate-pulse rounded-xl bg-cream" />
          <div className="h-4 w-40 animate-pulse rounded bg-cream" />
          <div className="mt-4 h-14 w-full animate-pulse rounded-xl bg-cream" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-12 w-full animate-pulse rounded-xl bg-cream" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-cream" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || (!generation && !error)) {
    return (
      <DetailNotFound
        icon="image_not_supported"
        title="No encontramos este arte"
        message="No encontramos este arte en tu cuenta."
        backHref="/user/generations"
        backLabel="Volver a mi arte"
      />
    );
  }

  if (error || !generation) {
    return (
      <DetailErrorState
        back={<BackToGenerationsLink />}
        message={error ?? "No pudimos cargar este arte."}
        onRetry={reload}
      />
    );
  }

  const status = generation.status;
  const isReady = status === "completed";
  const imageUrl = generation.resultUrl ?? generation.thumbnailUrl;
  const petName = generation.pet?.name ?? "Tu arte";
  const styleName = generation.style?.displayName ?? generation.style?.category;
  const downloadName = buildDownloadName(
    styleName,
    generation.pet?.name,
    imageUrl,
  );
  // Tipo de producto de cara al cliente: formato + contenido, ej. "Canvas Print ·
  // Paint by Numbers". Mismo criterio que la ficha de producto (ProductInfo).
  const productLabel =
    [
      templateLabel(generation.productRef?.template),
    ]
      .filter(Boolean)
      .join(" · ") || "Personalizado";

  // Card principal del carrusel: el producto de origen si es físico y se pudo
  // resolver, y si no el kit PBN (obra digital, generación legacy sin
  // productRef, producto desactivado o handle que ya no existe en Shopify).
  const showProductCard = !sourceProduct.unavailable && !!sourceProduct.product;

  return (
    <div className="flex flex-col gap-6">
      <BackToGenerationsLink />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-16">
        {/* IZQUIERDA — imagen flotante */}
        <div className="lg:col-span-7">
          <GenerationImage
            status={status}
            imageUrl={imageUrl}
            errorMessage={generation.errorMessage}
            alt={petName}
          />
        </div>

        {/* DERECHA — ficha + cross-sell. Sin `sticky`: con el carrusel del kit
            esta columna es más alta que la imagen, así que fijarla no aporta
            nada y hacía que el carrusel (posicionado) se pintara encima del
            panel clavado al hacer scroll. */}
        <div className="flex flex-col lg:col-span-5">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              {styleName && (
                <span className="text-sm font-bold uppercase tracking-wider text-primary">
                  {styleName}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-text-main lg:text-5xl">
                  {petName}
                </h1>
                <GenerationStatusBadge status={status} />
              </div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
                <span>{productLabel}</span>
                <span className="text-text-muted/50">·</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    calendar_today
                  </span>
                  {formatOrderDate(generation.createdAt)}
                </span>
              </p>
            </div>
            <div className="h-px w-full bg-linear-to-r from-text-main/15 via-text-main/5 to-transparent" />

            <div className="flex flex-col gap-3">
              {/* Acción secundaria: descarga */}
              {isReady && imageUrl && (
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownload(imageUrl, downloadName)}
                    disabled={downloading}
                    className="group flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E0DED9] bg-white px-4 text-sm font-bold text-text-main shadow-sm transition-all hover:border-primary/40 hover:bg-gray-50 hover:text-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] text-text-muted transition-colors group-hover:text-primary ${
                        downloading ? "animate-pulse" : ""
                      }`}
                    >
                      download
                    </span>
                    {downloading ? "Descargando…" : "Descargar imagen"}
                  </button>
                </div>
              )}

              {/* Borrar */}
              <div className="mt-1 h-px w-full bg-text-main/10" />
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={deleting}
                className="w-full p-4 inline-flex items-center justify-center gap-1.5 self-center rounded-xl px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">
                  delete
                </span>
                Borrar arte
              </button>
            </div>

            {/* El kit y sus accesorios comparten un carrusel: una slide a ancho
                completo cada uno. El padding horizontal deja sitio a las
                flechas, que Embla dibuja fuera del viewport. Solo con la obra
                terminada: no tiene sentido vender un puzzle de una generación
                que falló o sigue procesando. */}
            {/* En lanzamiento la card va directo al checkout de Shopify en vez
                de al carrito local (ver GenerationProductCard). */}
            {isReady &&
              imageUrl &&
              !sourceProduct.loading &&
              showProductCard && (
                <div className="">
                  <Carousel gap="gap-4" showDots>
                    {/* Producto de origen: el puzzle que el cliente eligió
                        antes de generar, con su obra impresa. */}
                    {showProductCard && (
                      <div className="min-w-0 flex-[0_0_100%]">
                        <GenerationProductCard
                          source={sourceProduct}
                          generationId={generation.id}
                          artworkUrl={imageUrl}
                          productLabel={productLabel}
                          styleName={styleName}
                        />
                      </div>
                    )}
                  </Carousel>
                </div>
              )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="¿Borrar este arte?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Borrar"
        loadingLabel="Borrando…"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setConfirmingDelete(false);
        }}
      >
        {isReady && imageUrl && (
          <div
            className="aspect-4/5 w-full rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url('${imageUrl}')` }}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
