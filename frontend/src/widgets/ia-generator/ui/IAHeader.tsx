import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { GenerationStatus } from "@/hooks/useGenerationStatus";

const DEFAULT_TOTAL_STEPS = 3;

interface IAHeaderProps {
  step: number;
  /**
   * Pasos totales del flujo. En lanzamiento son 2 cuando el usuario ya tiene
   * sesión (se salta el de cuenta): sin esto la barra saltaría de 1/3 a 3/3.
   */
  totalSteps?: number;
  generationStatus?: GenerationStatus;
  /**
   * Dónde va el pedido (bundle): al centro de la cabecera en desktop y en una
   * tarjeta bajo ella en móvil. Debe ser solo visual: se pinta dos veces.
   */
  indicator?: ReactNode;
}

export function IAHeader({
  step,
  totalSteps = DEFAULT_TOTAL_STEPS,
  generationStatus,
  indicator = null,
}: IAHeaderProps) {
  const isGenerating =
    generationStatus === "pending" || generationStatus === "processing";
  const progressPct = Math.min(100, (step / Math.max(totalSteps, 1)) * 100);

  return (
    <>
    <header className="bg-white border-b border-[#E5E0D8] sticky top-0 z-50">
      <div className="px-6 md:px-10 py-4 max-w-7xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="size-10 relative bg-white rounded-full">
            <Image
              src="/Logo.svg"
              alt="ClawPuzzle Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="font-display text-slate-dark text-xl font-black tracking-tight">
            Puzzle Salvaje
          </h2>
        </Link>

        {indicator ? (
          <div className="hidden md:flex min-w-0 animate-in fade-in duration-700">
            {indicator}
          </div>
        ) : isGenerating ? (
          <div className="hidden md:flex items-center gap-4 opacity-70 animate-in fade-in duration-700">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Generando
              </span>
              <span className="text-sm font-medium text-slate-dark">
                Creando tu arte con IA...
              </span>
            </div>
            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : null}

        <Link
          href="/"
          aria-label="Salir y volver al inicio"
          className="flex items-center justify-center size-9 rounded-lg border border-[#E5E0D8] text-slate-dark hover:bg-gray-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </Link>
      </div>

      {/* Barra de progreso a todo el ancho, bajo la cabecera */}
      <div className="w-full h-1 bg-[#dee2e3]">
        <div
          className="h-full bg-primary transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>

    {indicator && (
      <div className="md:hidden px-4 pt-4">
        <div className="rounded-xl border border-[#E0DED9] bg-white px-3 py-2.5">
          {indicator}
        </div>
      </div>
    )}
    </>
  );
}
