interface Perk {
  icon: string;
  title: string;
  detail: React.ReactNode;
}

// Perks del rompecabezas: envío, vista previa, hecho a pedido y créditos, que
// se ganan solo cuando el pedido tiene un costo de producción. Son promesas al
// cliente: cualquier cifra aquí debe coincidir con /shipping-returns.
const PERKS: Perk[] = [
  {
    icon: "local_shipping",
    title: "Envíos a todo Ecuador",
    detail: "Producción en 3 días y entrega en unos 3 días más, según tu ciudad.",
  },
  {
    icon: "visibility",
    title: "Vista previa gratis",
    detail: "Mira tu arte antes de comprar, sin sorpresas.",
  },
  {
    icon: "extension",
    title: "Hecho bajo pedido",
    detail: "Impreso en MDF de 3 mm solo para ti; por eso no aceptamos devoluciones por cambio de opinión.",
  },
  {
    icon: "redeem",
    title: "Gana 3 créditos",
    detail:
      "Cada rompecabezas que pides suma 3 créditos a tu cuenta para crear más arte.",
  },
];

// El formato Digital es un archivo descargable: no hay envío ni producción a
// pedido, y no otorga créditos (no tiene costo de producción). Se descarga pero
// a un tamaño ya definido, no en cualquier medida.
const DIGITAL_PERKS: Perk[] = [
  {
    icon: "download",
    title: "Descarga inmediata",
    detail: "Recibe tu archivo apenas pagues, sin envío.",
  },
  {
    icon: "visibility",
    title: "Vista previa gratis",
    detail: "Mira tu arte antes de comprar, sin sorpresas.",
  },
  {
    icon: "print",
    title: "Listo para imprimir",
    detail: "Listo para imprimir en casa.",
  },
];

interface ProductPerksProps {
  /** Formato de entrega normalizado (Digital | Canvas | Poster…). */
  template?: string;
}

export default function ProductPerks({ template }: ProductPerksProps) {
  const perks = template === "Digital" ? DIGITAL_PERKS : PERKS;

  return (
    <div className="rounded-xl bg-white divide-y divide-[#E0DED9]">
      {perks.map((perk) => (
        <div key={perk.title} className="flex items-center gap-5 px-6 py-4">
          <span className="material-symbols-outlined text-[28px] text-primary">
            {perk.icon}
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="font-display font-black text-text-main">
              {perk.title}
            </p>
            <p className="font-body text-sm text-text-muted">{perk.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
