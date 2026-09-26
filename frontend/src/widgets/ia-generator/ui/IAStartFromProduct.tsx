import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { LAUNCH_MODE } from "@/shared/config/launch";

interface IAStartFromProductProps {
  /** Reemplaza el subtítulo por defecto (p. ej. al fallar la carga del producto). */
  message?: string;
  actionHref?: string;
  actionLabel?: string;
}

/**
 * El generador es una ruta de continuación, no de entrada: producto, formato y
 * estilo se eligen en la ficha del producto. Si se llega sin ese contexto (o no
 * se pudo resolver), esto lo explica y devuelve al catálogo.
 */
export function IAStartFromProduct({
  message,
  // En lanzamiento no hay catálogo: `proxy.ts` rebota /catalog a `/`, así que el
  // destino natural es la galería de estilos de la landing.
  actionHref = LAUNCH_MODE ? "/#styles" : "/catalog",
  actionLabel = LAUNCH_MODE ? "Volver a los estilos" : "Ver productos",
}: IAStartFromProductProps) {
  return (
    <Container
      as="main"
      className="grow flex items-center justify-center py-16 animate-in fade-in duration-500"
    >
      <div className="max-w-md text-center flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-5xl text-primary">
          palette
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-black text-slate-dark tracking-tight">
          {LAUNCH_MODE ? "Empieza por un estilo" : "Empieza por un producto"}
        </h1>
        <p className="text-slate-dark/70 text-lg">
          {message ??
            (LAUNCH_MODE
              ? "Primero elige un estilo y luego sube la foto de tu mascota."
              : "Primero elige un producto y luego sube la foto de tu mascota.")}
        </p>
        <Link
          href={actionHref}
          className="mt-2 inline-flex items-center justify-center gap-2 h-14 px-8 bg-primary text-white rounded-full font-bold text-lg hover:bg-primary-dark hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          <span className="material-symbols-outlined">
            {LAUNCH_MODE ? "palette" : "storefront"}
          </span>
          {actionLabel}
        </Link>
      </div>
    </Container>
  );
}
