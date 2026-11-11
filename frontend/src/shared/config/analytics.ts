// IDs de medición (ver TRACKING.md). Vacíos = no se carga ningún script de
// Meta ni de Google: dev, previews y e2e quedan limpios. En Vercel solo están
// definidos en Production.
//
// Ojo: Next inlinea las `NEXT_PUBLIC_*` en tiempo de build, así que cambiar el
// valor exige rebuild/reinicio del dev server.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
