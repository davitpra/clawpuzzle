import Hero from "@/widgets/home-hero/ui/Hero";

export default function LandingHero({ background }: { background?: string }) {
  return (
    <Hero
      background={background}
      eyebrow="Vista previa gratis"
      title="Una pieza de tu mejor amigo para tenerla contigo"
      description="Elige un estilo y sube su foto favorita. Nuestra IA lo convierte en arte y tú ves la vista previa gratis. Si te enamora, lo imprimimos como rompecabezas en MDF de 3 mm y te lo enviamos a todo Ecuador."
      primaryCta={{
        href: "#styles",
        label: "Crear su rompecabezas",
        icon: "extension",
      }}
      secondaryCta={{ href: "#how-it-works", label: "Cómo funciona" }}
      note="Vista previa gratis · MDF de 3 mm · Envíos a todo Ecuador"
      // TODO(assets): la foto es de ClawAndSoul (alguien pintando un PBN).
      // Reemplazar por una del rompecabezas armado; el alt describe la actual.
      media={{
        kind: "image",
        src: "/landing/hero-main-v2.webp",
        alt: "Una persona pintando un retrato de su golden retriever mientras el perro la mira",
        width: 1125,
        height: 1398,
      }}
      mediaClassName="shadow-2xl"
      badge={{
        icon: "auto_awesome",
        title: "Vista previa gratis",
        subtitle: "Solo pagas si te encanta",
      }}
      animateText
    />
  );
}
