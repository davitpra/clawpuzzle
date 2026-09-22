import StudioShowcase, {
  type ShowcaseFeature,
} from "@/widgets/studio-showcase/ui/StudioShowcase";

const PROOF_POINTS: ShowcaseFeature[] = [
  { icon: "auto_awesome", text: "AI artwork made from your photo" },
  { icon: "palette", text: "Your chosen style becomes a numbered design" },
  { icon: "print", text: "Free PDF to print and paint at home" },
];

export default function LandingShowcase({
  background,
}: {
  background?: string;
}) {
  return (
    <StudioShowcase
      background={background}
      eyebrow="Before & After"
      title="See the Magic for Yourself"
      description="Drag the slider to see the journey from your pet's photo to AI artwork, then to a numbered paint-by-numbers design ready for your brush."
      features={PROOF_POINTS}
      image={{
        beforeSrc: "/studio/bengal-art.webp",
        afterSrc: "/studio/bengal-pbn.webp",
        beforeLabel: "AI Artwork",
        afterLabel: "Paint by Numbers",
        width: 928,
        height: 1152,
        alt: "A Bengal cat AI portrait transformed into a numbered paint-by-numbers design",
      }}
      primaryCta={null}
      secondaryCta={null}
    />
  );
}
