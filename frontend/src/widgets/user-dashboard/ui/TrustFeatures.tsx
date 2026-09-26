import { Container } from "@/shared/ui/Container";

interface Feature {
  icon: string;
  title: string;
  text: string;
}

const features: Feature[] = [
  {
    icon: "favorite",
    title: "Hecho con cariño",
    text: "Cada rompecabezas se prepara con cuidado para honrar a tu mascota.",
  },
  {
    icon: "workspace_premium",
    title: "MDF de 3 mm",
    text: "Un material firme, hecho para armarlo una y otra vez.",
  },
  {
    icon: "local_shipping",
    title: "Envíos a todo Ecuador",
    text: "Producción en 3 días y entrega en unos 3 días más.",
  },
  {
    icon: "verified",
    title: "Vista previa gratis",
    text: "Mira el resultado antes de pedir. Sin sorpresas.",
  },
];

export function TrustFeatures() {
  return (
    <section className="bg-cream py-14">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-black text-text-main sm:text-3xl">
            We&apos;re here for you and your pet.
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[28px]">
                  {feature.icon}
                </span>
              </span>
              <h3 className="font-display mt-4 text-lg font-black text-text-main">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-text-muted">{feature.text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
