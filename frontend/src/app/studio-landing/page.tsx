// La landing vive en `widgets/studio-landing/ui/StudioLandingPage` porque en
// modo lanzamiento la sirve `/` (ver `app/page.tsx`); esta ruta solo queda viva
// con el flag apagado — con el flag activo, `src/proxy.ts` la redirige a `/`.
export {
  default,
  studioLandingMetadata as metadata,
} from "@/widgets/studio-landing/ui/StudioLandingPage";
