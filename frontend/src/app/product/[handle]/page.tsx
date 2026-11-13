"use client";

import { Navbar } from "@/widgets/navbar";
import { Footer } from "@/widgets/footer";
import { useState, useEffect, use } from "react";
import { getProduct, ShopifyProduct } from "@/lib/shopify";
import Link from "next/link";
import { ProductPageTemplate } from "@/widgets/product-templates";
import { useBackendProductVariants } from "@/hooks/useBackendProductVariants";

export default function ProductDetail({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [mainImage, setMainImage] = useState("");
  const [loading, setLoading] = useState(true);
  const { product: backendProduct } = useBackendProductVariants(handle);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const fetchedProduct = await getProduct(handle);
        if (fetchedProduct) {
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct.variants.edges[0]?.node.id || "");
          setMainImage(fetchedProduct.images.edges[0]?.node.url || "");
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-background-light">
        <Navbar />
        <div className="grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-4xl font-black text-text-main mb-4">
              Producto no encontrado
            </h1>
            <Link
              href="/catalog"
              className="text-primary font-bold hover:underline"
            >
              Volver a la tienda
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const faqs = [
    {
      q: "¿Qué tipo de foto funciona mejor?",
      a: "Las fotos claras, en buena resolución y con luz natural funcionan mejor. Asegúrate de que la cara de tu mascota se vea bien y sin movimiento.",
    },
    {
      q: "¿Puedo ver el arte antes de comprar?",
      a: "¡Claro! La vista previa es gratis: ves el resultado antes de pedir tu rompecabezas.",
    },
    {
      q: "¿Cuánto tarda en llegar?",
      a: "Cada rompecabezas se hace bajo pedido: la producción toma 3 días y el envío de 3 a 7 días, según tu ciudad. Enviamos a todo Ecuador.",
    },
    {
      q: "¿El arte con IA es único?",
      a: "Sí. No hay dos resultados iguales: la IA trabaja cada foto por separado para que tu arte sea tan único como tu mascota.",
    },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-clip bg-white">
      <Navbar />

      <main className="flex-1 flex flex-col">
        <ProductPageTemplate
          product={product}
          templateOverride={backendProduct?.template ?? undefined}
          selectedVariantId={selectedVariantId}
          setSelectedVariantId={setSelectedVariantId}
          mainImage={mainImage}
          setMainImage={setMainImage}
          handle={handle}
          faqs={faqs}
        />
      </main>

      <Footer />
    </div>
  );
}
