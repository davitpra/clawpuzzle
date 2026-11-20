import StudioShowcase, {
  type ShowcaseFeature,
} from "@/widgets/studio-showcase/ui/StudioShowcase";

const PROOF_POINTS: ShowcaseFeature[] = [
  { icon: "visibility", text: "Vista previa gratis, sin tarjeta" },
  { icon: "extension", text: "Impreso en MDF de 3 mm" },
  { icon: "local_shipping", text: "Envío a todo Ecuador en 3 a 7 días" },
];

/**
 * CTA de cierre de la landing. El botón lleva a la ficha (`#product`) y no a
 * `/create`: el flujo necesita producto, formato y tema (Perro | Gato)
 * elegidos allí.
 */
export default function LandingShowcase({
  background,
}: {
  background?: string;
}) {
  return (
    <StudioShowcase
      background={background}
      eyebrow="Tu turno"
      title="Convierte a tu mascota en un rompecabezas"
      description="Sube su foto y mira la vista previa gratis en segundos. Solo pagas si te enamora."
      features={PROOF_POINTS}
      photo={{
        src: "/puzzle/Otto.webp",
        width: 1075,
        height: 1463,
        alt: "Rompecabezas de madera con el retrato IA de Otto, un perro con pañuelo de flores",
      }}
      primaryCta={{ href: "/#product", label: "Pruébalo gratis" }}
      secondaryCta={{ href: "/#styles", label: "Ver estilos" }}
    />
  );
}
