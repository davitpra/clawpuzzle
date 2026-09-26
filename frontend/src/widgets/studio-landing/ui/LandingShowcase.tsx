import StudioShowcase, {
  type ShowcaseFeature,
} from "@/widgets/studio-showcase/ui/StudioShowcase";

const PROOF_POINTS: ShowcaseFeature[] = [
  { icon: "auto_awesome", text: "Arte con IA hecho a partir de tu foto" },
  { icon: "extension", text: "Impreso como rompecabezas en MDF de 3 mm" },
  { icon: "local_shipping", text: "Listo para armar, con envío a todo Ecuador" },
];

export default function LandingShowcase({
  background,
}: {
  background?: string;
}) {
  return (
    <StudioShowcase
      background={background}
      eyebrow="Así se ve impreso"
      title="Mira la magia con tus propios ojos"
      description="Así queda el arte de tu mascota convertido en un rompecabezas de madera, listo para armar."
      features={PROOF_POINTS}
      photo={{
        src: "/puzzle/Otto.webp",
        width: 1075,
        height: 1463,
        alt: "Rompecabezas de madera con el retrato IA de Otto, un perro con pañuelo de flores",
      }}
      primaryCta={null}
      secondaryCta={null}
    />
  );
}
