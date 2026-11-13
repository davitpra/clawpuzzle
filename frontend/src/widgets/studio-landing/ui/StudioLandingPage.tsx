import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/widgets/navbar";
import { Footer } from "@/widgets/footer";
import ProductFAQ from "@/widgets/product-faq/ui/ProductFAQ";
import LandingHero from "./LandingHero";
import LandingShowcase from "./LandingShowcase";
import LandingStyles, { LandingStylesSkeleton } from "./LandingStyles";
import BrandBanner from "./BrandBanner";
import WhyItMatters from "./WhyItMatters";
import LandingProducts from "./LandingProducts";
import LandingProductDetails, {
  LandingProductDetailsSkeleton,
} from "./LandingProductDetails";
import { AIProcess, type ProcessStep } from "@/widgets/ai-process";
import SectionFlow from "@/shared/ui/SectionFlow";
import { LAUNCH_MODE } from "@/shared/config/launch";
import { SITE_URL } from "@/shared/config/seo";
import { LandingThemeProvider } from "../model/LandingThemeContext";

/**
 * SEO de la landing del studio. La sirve `/studio-landing` con el flag apagado
 * y `/` en modo lanzamiento (`app/page.tsx`), así que vive aquí y no en un
 * `page.tsx` concreto.
 */
export const studioLandingMetadata: Metadata = {
  metadataBase: SITE_URL,
  title: "Rompecabezas personalizado de tu mascota · ClawPuzzle",
  description:
    "Convierte la foto de tu mascota en arte con IA y mira la vista previa gratis. Lo imprimimos como rompecabezas en MDF de 3 mm y lo enviamos a todo Ecuador.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    locale: "es_EC",
    title: "Una pieza de tu mejor amigo para tenerla contigo · ClawPuzzle",
    description:
      "Arte con IA hecho con la foto de tu mascota, impreso como rompecabezas en MDF de 3 mm. Vista previa gratis y envíos a todo Ecuador.",
    siteName: "ClawPuzzle",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "La foto de tu mascota convertida en un rompecabezas personalizado",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Una pieza de tu mejor amigo para tenerla contigo · ClawPuzzle",
    description:
      "Arte con IA hecho con la foto de tu mascota, impreso como rompecabezas en MDF de 3 mm. Vista previa gratis y envíos a todo Ecuador.",
    images: ["/opengraph-image"],
  },
};

const LANDING_STEPS: ProcessStep[] = [
  {
    img: "/process/2 approve.png",
    alt: "Eligiendo un estilo de arte para el retrato de una mascota",
    title: "1. Elige un estilo",
    text: "Escoge el look que mejor va con la personalidad de tu mascota.",
  },
  {
    img: "/process/1. Upload Picture.png",
    alt: "Subiendo la foto de una mascota desde el celular",
    title: "2. Sube su foto",
    text: "Cualquier foto clara sirve, desde la del celular hasta esa favorita de hace años.",
  },
  {
    // TODO(assets): falta una imagen del rompecabezas impreso para un paso de
    // entrega propio; mientras tanto la entrega va en el texto de este paso.
    img: "/process/3. Final Art.png",
    alt: "Retrato de una mascota hecho con IA en una pantalla",
    title: "3. Mira la vista previa gratis",
    text: "Si te encanta, lo imprimimos en MDF de 3 mm: 3 días de producción y de 3 a 7 días de envío a tu ciudad.",
  },
];

const LANDING_FAQS = [
  {
    q: "¿La vista previa es gratis de verdad?",
    a: "Sí. Tu primera vista previa es gratis y no necesitas cuenta ni tarjeta de crédito. Si creas tu cuenta con Google recibes 4 vistas previas gratis más. Solo pagas cuando decides pedir tu rompecabezas.",
  },
  {
    q: "¿Necesito una cuenta?",
    a: "No para tu primera vista previa: la creas y puedes pedir tu rompecabezas sin registrarte. Si quieres guardarla y volver a ella más adelante, crea tu cuenta gratis con Google y tendrás 4 vistas previas más.",
  },
  {
    q: "¿De qué material es el rompecabezas?",
    a: "Se imprime sobre MDF de 3 mm, un material firme que no se dobla ni se deshace. Está hecho para armarlo muchas veces.",
  },
  {
    q: "¿Cuánto tarda en llegar?",
    a: "Lo producimos en 3 días y el envío toma de 3 a 7 días, según tu ciudad. Te avisamos por correo cuando sale de nuestro taller.",
  },
  {
    q: "¿A dónde hacen envíos?",
    a: "Enviamos a todo Ecuador.",
  },
  {
    q: "¿Qué fotos funcionan mejor?",
    a: "Una foto clara y con buena luz, donde se vea bien la cara de tu mascota. Las fotos del celular y las fotos antiguas suelen funcionar muy bien.",
  },
  {
    q: "¿Qué pasa con la foto de mi mascota?",
    a: "Tu foto se sube para que podamos crear y guardar tu arte. Puedes borrar tus fotos y tus diseños desde tu cuenta cuando quieras. Nunca vendemos tus fotos.",
  },
];

export default function StudioLandingPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-clip bg-background-light">
      <Navbar />

      <main className="flex-1">
        <LandingThemeProvider>
          <SectionFlow
            start="white"
            sections={[
              {
                id: "product",
                node: (
                  <Suspense
                    fallback={<LandingProductDetailsSkeleton background="" />}
                  >
                    <LandingProductDetails background="" />
                  </Suspense>
                ),
              },
              {
                id: "styles",
                node: (
                  <Suspense fallback={<LandingStylesSkeleton background="" />}>
                    <LandingStyles background="" />
                  </Suspense>
                ),
              },
              {
                id: "process",
                node: (
                  // Destino de "How It Works" en el footer: /#how-it-works.
                  <div id="how-it-works" className="scroll-mt-20">
                    <AIProcess
                      eyebrow="Cómo funciona"
                      title="De foto a rompecabezas en 3 pasos"
                      subtitle={
                        <>
                          La vista previa es gratis.
                          <br />
                          Solo pagas si te enamora.
                        </>
                      }
                      steps={LANDING_STEPS}
                    />
                  </div>
                ),
              },

              {
                id: "products",
                pin: "white",
                when: !LAUNCH_MODE,
                node: <LandingProducts background="" />,
              },
              { id: "brand", node: <BrandBanner /> },
              // { id: "why", node: <WhyItMatters /> },
              {
                id: "faq",
                node: (
                  // Destino de "FAQ" en el footer: /#faq.
                  <div id="faq" className="scroll-mt-20">
                    <ProductFAQ faqs={LANDING_FAQS} background="" />
                  </div>
                ),
              },
              {
                id: "showcase",
                node: <LandingShowcase background="" />,
              },
            ]}
          />
        </LandingThemeProvider>
      </main>

      <Footer />
    </div>
  );
}
