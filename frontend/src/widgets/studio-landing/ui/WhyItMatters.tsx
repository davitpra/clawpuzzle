// import Image from "next/image";
import { Container } from "@/shared/ui/Container";

// const COMPARISON = [
//   "Hecho con la foto de tu mascota",
//   "Vista previa gratis antes de pagar",
//   "MDF resistente de 3 mm",
//   "Envíos a todo Ecuador",
// ];

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
    text: "Lo producimos en 3 días y llega en unos 3 días más, según tu ciudad.",
  },
  {
    title: "Un plan para compartir",
    text: "Ármalo en familia y quédate con un recuerdo que se puede tocar.",
  },
];

// const CARD_BORDER = "border-[#E0DED9]";

export default function WhyItMatters() {
  // const last = COMPARISON.length - 1;

  return (
    <section className="w-full pb-20">
      <Container>
        {/* <div className="grid grid-cols-1 items-center gap-10 py-14 md:grid-cols-2 md:gap-8 md:py-20">
          <h2 className="text-center font-display text-3xl font-black tracking-tight text-slate-dark md:text-4xl">
            ¿Por qué elegirnos?
          </h2>

          <div className="mx-auto w-full max-w-md drop-shadow-md">
            <table className="w-full border-separate border-spacing-0 text-slate-dark">
              <thead>
                <tr>
                  <td />
                  <th
                    scope="col"
                    className="w-30 rounded-t-2xl bg-primary px-2 pb-3 pt-4 text-sm font-bold text-white sm:w-36"
                  >
                    <Image
                      src="/Logo.svg"
                      alt="ClawPuzzle"
                      width={32}
                      height={32}
                      className="mx-auto size-8 brightness-0 invert"
                    />
                  </th>
                  <th
                    scope="col"
                    className="w-16 px-2 pb-3 pt-4 text-sm font-bold sm:w-20"
                  >
                    Otros
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((label, i) => (
                  <tr key={label}>
                    <th
                      scope="row"
                      className={[
                        "border-b border-l bg-white px-4 py-3.5 text-center text-sm font-bold leading-snug",
                        CARD_BORDER,
                        i === 0 ? "rounded-tl-xl border-t" : "",
                        i === last ? "rounded-bl-xl" : "",
                      ].join(" ")}
                    >
                      {label}
                    </th>
                    <td className="bg-primary text-center">
                      <span
                        aria-label="Sí"
                        className="material-symbols-outlined text-[20px] leading-none text-white"
                      >
                        check
                      </span>
                    </td>
                    <td
                      className={[
                        "border-b border-r bg-white text-center",
                        CARD_BORDER,
                        i === 0 ? "rounded-tr-xl border-t" : "",
                        i === last ? "rounded-br-xl" : "",
                      ].join(" ")}
                    >
                      <span
                        aria-label="No"
                        className="material-symbols-outlined text-[20px] leading-none"
                      >
                        close
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td className="h-4 rounded-b-2xl bg-primary" />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div> */}

        <ul className="grid grid-cols-1 gap-x-16 gap-y-9 md:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[36px] leading-none text-primary"
              >
                check_circle
              </span>
              <div>
                <h3 className="font-display text-base font-black text-slate-dark">
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
    </section>
  );
}
