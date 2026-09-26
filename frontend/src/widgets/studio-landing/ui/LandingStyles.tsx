import {
  fetchPublicStyles,
  withPreviewArt,
} from "@/entities/art-style/api/fetchPublicStyles";
import { LandingStylesView } from "./LandingStylesView";

export { LandingStylesSkeleton } from "./LandingStylesView";

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

  return (
    <LandingStylesView
      styles={withPreviewArt(publicStyles)}
      background={background}
    />
  );
}
