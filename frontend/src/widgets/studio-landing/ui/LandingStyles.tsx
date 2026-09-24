import { Container } from "@/shared/ui/Container";
import { Carousel } from "@/shared/ui/Carousel";
import LightRays from "@/shared/ui/LightRays";
import { fetchPublicStyles } from "@/entities/art-style/api/fetchPublicStyles";
import { LandingStyleCard } from "./LandingStyleCard";
import { LandingStylesEmpty } from "./LandingStylesEmpty";

function SectionHeading() {
  return (
    <div className="mb-14 text-center">
      <span className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
        Art styles
      </span>
      <h2 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
        One Photo, Your Style
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-dark/55">
        Choose the look that feels right for your pet. Each style comes with
        its own paint-by-numbers difficulty.
      </p>
    </div>
  );
}

export function LandingStylesSkeleton({
  background = "bg-white",
}: {
  background?: string;
}) {
  return (
    <section
      id="styles"
      className={`relative w-full scroll-mt-24 overflow-hidden py-20 ${background}`}
    >
      <Container>
        <SectionHeading />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-4">
              <div className="aspect-2/3 animate-pulse bg-slate-200" />
              <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/**
 * La sección se renderiza **siempre**, tenga o no tarjetas que mostrar.
 *
 * Antes hacía `return null` tanto si fallaba la petición como si ningún estilo
 * traía imagen, y las dos cosas salían muy caras y en silencio: desaparecía el
 * ancla `#styles`, y con ella el destino del CTA principal del hero, del CTA
 * del footer y del link "Create your art" —el embudo entero se quedaba sin
 * puerta de entrada—. Además `SectionFlow` ya le había asignado su turno en la
 * alternancia de color, así que el hueco de altura 0 dejaba dos divisores de
 * ola pegados. Su docstring lo avisa: una sección no debe ocultarse sola.
 */
export default async function LandingStyles({
  background = "bg-white",
}: {
  background?: string;
}) {
  let publicStyles: Awaited<ReturnType<typeof fetchPublicStyles>> = [];
  try {
    publicStyles = await fetchPublicStyles();
  } catch (error) {
    // Que quede en el log del servidor: un fallo silencioso aquí se veía solo
    // como una sección que no está.
    console.error("LandingStyles: no se pudieron cargar los estilos", error);
  }

  const styles = publicStyles.flatMap((style) => {
    const art = style.images.find((image) => image.orderIndex === 0);
    if (!art) return [];

    return [{ style, art }];
  });

  return (
    <section
      id="styles"
      className={`relative w-full scroll-mt-24 overflow-hidden py-20 ${background}`}
    >
      <Container>
        <SectionHeading />
        {styles.length === 0 ? (
          <LandingStylesEmpty />
        ) : (
          <Carousel gap="gap-4 md:gap-8" perView={4} mobileSlides={2}>
            {styles.map(({ style, art }) => (
              <LandingStyleCard
                key={style.id}
                id={style.id}
                displayName={style.displayName}
                difficulty={style.difficulty}
                artUrl={art.imageUrl}
                artAlt={
                  art.altImage ?? `${style.displayName} pet portrait art example`
                }
              />
            ))}
          </Carousel>
        )}
      </Container>
      <LightRays />
    </section>
  );
}
