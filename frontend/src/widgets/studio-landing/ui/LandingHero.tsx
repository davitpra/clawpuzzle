import Hero from "@/widgets/home-hero/ui/Hero";

export default function LandingHero({ background }: { background?: string }) {
  return (
    <Hero
      background={background}
      eyebrow="5 Free AI Pet Artworks"
      title="Turn Their Photo Into Art You Paint Yourself"
      description="Pick a style and upload a favorite photo. We’ll turn your pet into custom AI art, then a printable paint-by-numbers PDF you can download free or order on canvas."
      primaryCta={{
        href: "#styles",
        label: "Turn My Pet Into Art",
        icon: "palette",
      }}
      secondaryCta={{ href: "#how-it-works", label: "See How It Works" }}
      note="5 free artworks · Free printable PDF · Canvas available"
      media={{
        kind: "image",
        src: "/landing/hero-main-v2.webp",
        alt: "A pet parent painting a paint-by-numbers portrait of their golden retriever while the dog watches",
        width: 1125,
        height: 1398,
      }}
      mediaClassName="shadow-2xl"
      badge={{
        icon: "auto_awesome",
        title: "5 Free Artworks",
        subtitle: "Free printable PDF included",
      }}
      animateText
    />
  );
}
