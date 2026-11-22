import { Container } from "@/shared/ui/Container";

// Lo que incluye el rompecabezas. Debe coincidir con `ProductPerks` y con
// /shipping-returns (envío, tiempos).
const BENEFITS = [
  {
    title: "Rompecabezas",
    text: "Tu mascota impresa sobre MDF de 3 mm, firme para armarlo una y otra vez.",
  },
  {
    title: "Base + Soporte",
    text: "Para exhibirlo armado en tu repisa o escritorio.",
  },
  {
    title: "Caja Premium",
    text: "Llega en una caja lista para regalar y para guardar las piezas.",
  },
  {
    title: "Envío gratis",
    text: "Lo producimos en 3 días y el envío toma de 3 a 7 días, según tu ciudad.",
  },
  {
    title: "Tarjeta de $10",
    text: "Un descuento de $10 en tu próxima compra.",
  },
  {
    title: "3 créditos adicionales",
    text: "Para crear 3 vistas previas más y probar otros estilos.",
  },
  {
    title: "Vistas previas",
    text: "Te quedas con los diseños que generaste de tu mascota.",
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
          Todo lo que incluye
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
                <p className="mt-1 text-start text-sm leading-relaxed text-slate-dark/70">
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
