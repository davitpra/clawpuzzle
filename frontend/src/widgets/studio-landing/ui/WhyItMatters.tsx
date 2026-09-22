import Image from "next/image";
import { Container } from "@/shared/ui/Container";

const COMPARISON = [
  "Made from your pet's photo",
  "Instant digital delivery",
  "Print it anytime, anywhere",
  "Affordable and meaningful",
];

const BENEFITS = [
  {
    title: "Truly Personal",
    text: (
      <>
        Every design is made from <em>your</em> pet&apos;s photo, not a generic
        template.
      </>
    ),
  },
  {
    title: "Fast & Easy",
    text: "Get your custom PDF in hours, ready to print and color.",
  },
  {
    title: "Print Anywhere, Anytime",
    text: "Reprint it as many times as you want, whenever you want.",
  },
  {
    title: "Affordable Memories",
    text: "A unique keepsake without spending hundreds on framed art.",
  },
  {
    title: "Stress-Free Fun",
    text: "Relax, color, and create a piece you'll treasure forever.",
  },
];

const CARD_BORDER = "border-[#E0DED9]";

export default function WhyItMatters() {
  const last = COMPARISON.length - 1;

  return (
    <section className="w-full pb-20">
      <Container>
        <div className="grid grid-cols-1 items-center gap-10 py-14 md:grid-cols-2 md:gap-8 md:py-20">
          <h2 className="text-center font-display text-3xl font-black tracking-tight text-slate-dark md:text-4xl">
            Why we stand out?
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
                    Others
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
                        aria-label="Yes"
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
        </div>

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
