import { Container } from "@/shared/ui/Container";
import { Carousel } from "@/shared/ui/Carousel";
import LightRays from "@/shared/ui/LightRays";
import { fetchPublicStyles } from "@/entities/art-style/api/fetchPublicStyles";
import { LandingStyleCard } from "./LandingStyleCard";

function SectionHeading() {
  return (
    <div className="mb-14 text-center">
      <span className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
        Art styles
      </span>
      <h2 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-slate-dark md:text-5xl">
        One Photo, Endless Styles
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-dark/55">
        With an Easy, Medium or Challenging paint difficulty, so there&apos;s a
        canvas for every skill level.
      </p>
    </div>
  );
}

export function LandingStylesSkeleton() {
  return (
    <section
      id="styles"
      className="relative w-full scroll-mt-24 overflow-hidden bg-white py-20"
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

export default async function LandingStyles() {
  let publicStyles: Awaited<ReturnType<typeof fetchPublicStyles>>;
  try {
    publicStyles = await fetchPublicStyles();
  } catch {
    return null;
  }

  const styles = publicStyles.flatMap((style) => {
    const art = style.images.find((image) => image.orderIndex === 0);
    if (!art) return [];

    return [{ style, art }];
  });

  if (styles.length === 0) return null;

  return (
    <section
      id="styles"
      className="relative w-full scroll-mt-24 overflow-hidden bg-white py-20"
    >
      <Container>
        <SectionHeading />
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
      </Container>
      <LightRays />
    </section>
  );
}
