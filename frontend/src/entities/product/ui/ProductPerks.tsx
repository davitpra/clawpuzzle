// Oferta de valor del rompecabezas. Son promesas al cliente: cualquier cifra
// aquí (envío, tiempos, devoluciones) debe coincidir con /shipping-returns.
const PERKS: string[] = [
  "Rompecabezas MDF 3mm",
  "Base + Soporte ($14 Gratis)",
  "Caja Premium + Faja",
  "Envío Gratis a todo Ecuador",
  "Tarjeta $10 próxima compra",
  "Vista previa gratis",
  "Gana 3 créditos por pedido",
  "Hecho bajo pedido",
];

const PERKS_NOTE =
  "Producción en 3 días y envío de 3 a 7 días, según tu ciudad.";

// El formato Digital es un archivo descargable: no hay envío ni producción a
// pedido, y no otorga créditos (no tiene costo de producción). Se descarga pero
// a un tamaño ya definido, no en cualquier medida.
const DIGITAL_PERKS: string[] = [
  "Descarga inmediata",
  "Vista previa gratis",
  "Listo para imprimir en casa",
];

interface ProductPerksProps {
  /** Formato de entrega normalizado (Digital | Canvas | Poster…). */
  template?: string;
}

export default function ProductPerks({ template }: ProductPerksProps) {
  const isDigital = template === "Digital";
  const perks = isDigital ? DIGITAL_PERKS : PERKS;

  return (
    <div className="rounded-xl bg-white px-6 py-5">
      <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[22px] leading-none text-green-700"
            >
              check
            </span>
            <span className="font-body font-bold text-text-main">{perk}</span>
          </li>
        ))}
      </ul>
      {!isDigital && (
        <p className="mt-4 border-t border-[#E0DED9] pt-4 font-body text-sm text-text-muted">
          {PERKS_NOTE}
        </p>
      )}
    </div>
  );
}
