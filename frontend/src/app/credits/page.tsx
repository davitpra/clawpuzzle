import type { Metadata } from "next";
import { Navbar } from "@/widgets/navbar";
import { Footer } from "@/widgets/footer";
import { CreditPackCard } from "@/features/credit-pack-purchase/CreditPackCard";

export const metadata: Metadata = {
  title: "Comprar créditos · ClawPuzzle",
  description:
    "Recarga tus créditos para crear más vistas previas de tu mascota.",
};

export default function CreditsPage() {
  return (
    <div className="bg-cream min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 md:px-10 lg:px-40 py-10 font-body">
        <div className="max-w-2xl mx-auto w-full">
          <header className="mb-8 text-center">
            <h1 className="font-display font-black text-3xl md:text-4xl text-text-main">
              Créditos
            </h1>
            <p className="mt-3 text-text-muted">
              Cada crédito es una vista previa con IA de tu mascota. Tu cuenta empieza
              con 5 créditos gratis y cada rompecabezas que pides suma 3 más. Elige
              un paquete para recargar.
            </p>
          </header>

          <CreditPackCard />
        </div>
      </main>

      <Footer />
    </div>
  );
}
