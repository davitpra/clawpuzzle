import type { ReactNode } from "react";
import Link from "next/link";
import { getProduct } from "@/lib/shopify/actions/products";
import type { ShopifyProduct } from "@/lib/shopify";
import { fetchLaunchProduct } from "@/entities/product/api/fetchLaunchProduct";
import LandingProductDetailsClient from "./LandingProductDetailsClient";

function SectionShell({
  background,
  children,
}: {
  background: string;
  children: ReactNode;
}) {
  // Mismo layout que la ficha de `ArtProductTemplate`.
  return (
    <section
      id="product"
      className={`relative w-full scroll-mt-24 flex justify-center py-6 md:py-10 px-4 md:px-10 lg:px-40 ${background}`}
    >
      <div className="max-w-300 w-full">{children}</div>
    </section>
  );
}

export function LandingProductDetailsSkeleton({
  background = "bg-white",
}: {
  background?: string;
}) {
  return (
    <SectionShell background={background}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-16">
        <div className="aspect-square animate-pulse bg-slate-200 lg:col-span-7" />
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="h-10 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-24 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-14 w-full animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
    </SectionShell>
  );
}

/**
 * Ficha del producto de lanzamiento (el marcado en el admin), primera sección
 * de la landing. Como `LandingStyles`, se renderiza **siempre**: si no hay
 * producto configurado deja un aviso en vez de un hueco, para no romper la
 * alternancia de fondos de `SectionFlow`.
 */
export default async function LandingProductDetails({
  background = "bg-white",
}: {
  background?: string;
}) {
  let product: ShopifyProduct | null = null;
  let template: string | null = null;
  try {
    const launch = await fetchLaunchProduct();
    if (launch) {
      template = launch.template;
      product = await getProduct(launch.shopifyHandle);
    }
  } catch (error) {
    console.error(
      "LandingProductDetails: no se pudo cargar el producto de lanzamiento",
      error,
    );
  }

  if (!product) {
    return (
      <SectionShell background={background}>
        <div className="py-10 text-center">
          <p className="font-body text-base text-slate-dark/60">
            Nuestro rompecabezas se está preparando. Mientras tanto, elige un estilo
            y crea gratis la vista previa de tu mascota.
          </p>
          <Link
            href="#styles"
            className="mt-4 inline-block font-bold text-primary hover:underline"
          >
            Ver estilos
          </Link>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell background={background}>
      <LandingProductDetailsClient
        product={product}
        template={template}
      />
    </SectionShell>
  );
}
