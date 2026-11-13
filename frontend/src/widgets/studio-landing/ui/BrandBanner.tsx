import { Container } from "@/shared/ui/Container";

const BENEFITS = [
  {
    title: "Único de verdad",
    text: (
      <>
        Cada diseño nace de la foto de <em>tu</em> mascota, no de una plantilla
        genérica.
      </>
    ),
  },
  {
    title: "Lo ves antes de comprar",
    text: "La vista previa es gratis. Solo pagas si te encanta el resultado.",
  },
  {
    title: "Hecho para durar",
    text: "Impreso sobre MDF de 3 mm: firme para armarlo una y otra vez.",
  },
  {
    title: "Rápido hasta tu puerta",
    text: "Lo producimos en 3 días y el envío toma de 3 a 7 días, según tu ciudad.",
  },
  {
    title: "Un plan para compartir",
    text: "Ármalo en familia y quédate con un recuerdo que se puede tocar.",
  },
];

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
          Claw Puzzle
        </p>
        <p className="mt-5 text-base font-bold uppercase tracking-wide text-slate-dark md:text-lg">
          Tu mejor amigo, pieza por pieza
        </p>
        <ul className="grid grid-cols-1 gap-x-16 gap-y-9 md:grid-cols-2 mt-12">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[36px] leading-none text-primary text-start"
              >
                check_circle
              </span>
              <div>
                <h3 className="font-display text-base font-black text-slate-dark text-start">
                  {benefit.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-dark/70">
                  {benefit.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
