"use client";

import Accordion from "@/shared/ui/Accordion";

interface FAQItem {
  q: string;
  a: string;
}

interface ProductFAQProps {
  faqs: FAQItem[];
  /** Clase de fondo. Dentro de un `SectionFlow` el color lo pone el wrapper. */
  background?: string;
}

export default function ProductFAQ({
  faqs,
  background = "bg-white",
}: ProductFAQProps) {
  return (
    <div className={`p-6 md:p-12 ${background}`}>
      <h2 className="mb-16 text-center font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
        Preguntas frecuentes
      </h2>
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {faqs.map((faq, i) => (
          <Accordion
            key={i}
            title={faq.q}
            className="bg-[var(--section-contrast,var(--color-cream))] rounded-xl shadow-sm"
            summaryClassName="w-full p-5"
            titleClassName="font-bold text-text-main text-lg"
            iconClassName="text-text-main"
            contentClassName="px-5 pb-5 pt-0 text-text-main/80 leading-relaxed font-body"
          >
            {faq.a}
          </Accordion>
        ))}
      </div>
    </div>
  );
}
