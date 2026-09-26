import { Container } from "@/shared/ui/Container";

/**
 * Banner de marca. No pinta fondo propio: lo asigna `SectionFlow` según su
 * posición, y el divisor ondulado se encarga de la transición con las
 * secciones vecinas.
 */
export default function BrandBanner() {
  return (
    <div className="py-12 text-center">
      <Container>
        <p className="font-display text-5xl font-black uppercase leading-none tracking-tight text-slate-dark md:text-6xl">
          ClawPuzzle
        </p>
        <p className="mt-5 text-base font-bold uppercase tracking-wide text-slate-dark md:text-lg">
          Tu mejor amigo, pieza por pieza
        </p>
      </Container>
    </div>
  );
}
