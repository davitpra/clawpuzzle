import type { Metadata } from "next";
import { Navbar } from "@/widgets/navbar";
import { Footer } from "@/widgets/footer";
import { HomeHero } from "@/widgets/home-hero";
import { NewCollection } from "@/widgets/collection";
import { CategoryGrid } from "@/widgets/category-grid";
import { HomeStyleGallery } from "@/widgets/style-gallery";
import { StudioShowcase } from "@/widgets/studio-showcase";
import {
  StudioLandingPage,
  studioLandingMetadata,
} from "@/widgets/studio-landing";
import { LAUNCH_MODE } from "@/shared/config/launch";
import WavesDivider from "@/shared/ui/WavesDivider";

// En modo lanzamiento `/` es la landing del studio, así que hereda su SEO; con
// el flag apagado, el home sigue heredando el metadata de `app/layout.tsx`.
// Se usa `generateMetadata` y no `export const metadata` para poder devolver un
// objeto vacío en ese segundo caso.
export function generateMetadata(): Metadata {
  return LAUNCH_MODE ? studioLandingMetadata : {};
}

export default async function Home() {
  // Modo lanzamiento: el home es la landing del studio (§3.3 de LAUNCH_PLAN.md).
  // La tienda completa vuelve apagando `NEXT_PUBLIC_LAUNCH_MODE`.
  if (LAUNCH_MODE) {
    return <StudioLandingPage />;
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-clip bg-background-light">
      <Navbar />

      <main className="flex-1">
        <HomeHero />
        <WavesDivider />
        <NewCollection />
        <WavesDivider flip />
        <HomeStyleGallery />
        <WavesDivider />
        <CategoryGrid />
        <WavesDivider flip />
        <StudioShowcase />
      </main>

      <Footer />
    </div>
  );
}
