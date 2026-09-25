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

/**
 * SEO de la landing del studio. La sirve `/studio-landing` con el flag apagado
 * y `/` en modo lanzamiento (`app/page.tsx`), así que vive aquí y no en un
 * `page.tsx` concreto.
 */
export const studioLandingMetadata: Metadata = {
  metadataBase: SITE_URL,
  title: "Turn Your Pet Into Art & Paint It Free · ClawPuzzle",
  description:
    "Create 5 free AI artworks from your pet's photo, turn your favorite into a free printable paint-by-numbers PDF, or order it on canvas.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Turn Your Pet Into Art & Paint It Free · ClawPuzzle",
    description:
      "Create 5 free AI artworks from your pet's photo, download a free printable paint-by-numbers PDF, or order it on canvas.",
    siteName: "ClawPuzzle",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Turn your pet's photo into AI art and a paint-by-numbers canvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Turn Your Pet Into Art & Paint It Free · ClawPuzzle",
    description:
      "Create 5 free AI artworks from your pet's photo, download a free printable paint-by-numbers PDF, or order it on canvas.",
    images: ["/opengraph-image"],
  },
};

const LANDING_STEPS: ProcessStep[] = [
  {
    img: "/process/2 approve.png",
    alt: "Choosing an AI art style for a pet portrait",
    title: "1. Pick a Style",
    text: "Choose the look that feels right for your pet. Each style has its own paint-by-numbers difficulty.",
  },
  {
    img: "/process/1. Upload Picture.png",
    alt: "Uploading a pet photo from a phone",
    title: "2. Upload a Photo",
    text: "Any clear photo of your pet works — from phone snapshots to old favorites.",
  },
  {
    img: "/process/3. Final Art.png",
    alt: "Finished AI portrait of a pet on a screen",
    title: "3. Get Your Art",
    text: "Our AI turns your photo into a custom portrait in the style you chose. You get five artworks free.",
  },
  {
    img: "/process/4. Paint your art.png",
    alt: "Painting a numbered pet portrait with a brush and palette",
    title: "4. Paint It",
    text: "Turn your favorite artwork into a paint-by-numbers design. Download the free PDF or order it on canvas.",
  },
];

const LANDING_FAQS = [
  {
    q: "Is the coloring page really free?",
    a: "Yes. You get 5 free AI artworks, and you can turn any of them into a printable paint-by-numbers PDF at no cost. No credit card is needed. You only pay if you want the design printed on canvas.",
  },
  {
    q: "Do I need an account?",
    a: "Yes, a free account is required to create AI artwork. Every new account starts with 5 free artworks, and you never need to add a payment method to use them.",
  },
  {
    q: "What photos work best?",
    a: "A clear, well-lit photo where your pet's face is easy to see gives the best result. Old photos, phone snapshots and even slightly blurry favorites usually work great — our AI does the heavy lifting.",
  },
  {
    q: "What happens to my pet's photo?",
    a: "When you create AI artwork, your pet's photo is uploaded so our service can generate and save your artwork. You can delete saved photos and artwork from your account whenever you want. We never sell your photos.",
  },
  {
    q: "How does the AI styling work?",
    a: "Our AI studies your photo and redraws your pet in the art style you pick — watercolor, linocut, royal portrait and more. You see the preview before anything is printed, so there are no surprises.",
  },
  {
    q: "Can I choose the difficulty?",
    a: "The difficulty comes with the style you choose. Each style is configured as Easy, Medium or Challenging, so you can pick the look and level of detail that suits you.",
  },
  {
    q: "Can I get it as a physical product?",
    a: "Yes. The only physical product available at launch is a ready-to-paint canvas printed with your numbered design.",
  },
  {
    q: "What do I need to paint it?",
    a: "You will need acrylic paint and a couple of brushes: a fine one for small numbered areas and a wider one for the background. The free PDF lets you use the supplies you already have.",
  },
  {
    q: "Where do you ship, and how long does it take?",
    a: "Canvas orders ship across Canada. You will get a tracking link by email when your order leaves our studio.",
  },
  {
    q: "What if I want another style?",
    a: "Create another artwork in a different style with one of your remaining free artworks. You can reuse a saved pet photo or upload a new one.",
  },
  {
    q: "Is this a good memorial gift?",
    a: "Many of our customers paint portraits of pets who have passed away. Families tell us that painting their companion, stroke by stroke, becomes a gentle and healing way to remember them. It's one of the most meaningful gifts you can give someone who is grieving a pet.",
  },
];

export default function StudioLandingPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-clip bg-background-light">
      <Navbar />

      <main className="flex-1">
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
                    eyebrow="How it works"
                    title="From Photo to Masterpiece in 4 Steps"
                    subtitle={
                      <>
                        Free to try, free to download.
                        <br />
                        Your first coloring page is on us.
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
            { id: "why", node: <WhyItMatters /> },
            {
              id: "faq",
              node: (
                // Destino de "FAQ" en el footer: /#faq.
                <div id="faq" className="scroll-mt-20">
                  <ProductFAQ faqs={LANDING_FAQS} background="" />
                </div>
              ),
            },
            { id: "showcase", node: <LandingShowcase background="" /> },
          ]}
        />
      </main>

      <Footer />
    </div>
  );
}
