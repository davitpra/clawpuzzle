import StudioShowcase, {
  type ShowcaseFeature,
} from "@/widgets/studio-showcase/ui/StudioShowcase";

const PROOF_POINTS: ShowcaseFeature[] = [
  { icon: "auto_awesome", text: "Arte con IA hecho a partir de tu foto" },
  { icon: "extension", text: "Impreso como rompecabezas en MDF de 3 mm" },
  { icon: "local_shipping", text: "Listo para armar, con envío a todo Ecuador" },
];

// TODO(assets): las imágenes siguen siendo las de ClawAndSoul (arte → PBN).
// Hacen falta un "antes" (arte IA) y un "después" (el rompecabezas impreso);
// hasta entonces `StudioLandingPage` no pinta esta sección en lanzamiento.
export default function LandingShowcase({
  background,
}: {
  background?: string;
}) {
  return (
    <StudioShowcase
      background={background}
      eyebrow="Antes y después"
      title="Mira la magia con tus propios ojos"
      description="Desliza para ver cómo el arte de tu mascota se convierte en un rompecabezas de verdad."
      features={PROOF_POINTS}
      image={{
        beforeSrc: "/studio/bengal-art.webp",
        afterSrc: "/studio/bengal-pbn.webp",
        beforeLabel: "Arte IA",
        afterLabel: "Rompecabezas",
        width: 928,
        height: 1152,
        alt: "Retrato IA de un gato bengalí convertido en rompecabezas",
      }}
      primaryCta={null}
      secondaryCta={null}
    />
  );
}
