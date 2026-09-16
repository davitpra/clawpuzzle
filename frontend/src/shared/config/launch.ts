// Modo lanzamiento: el sitio se reduce al embudo landing → arte IA → studio →
// PBN → canvas. Con el flag activo, `src/proxy.ts` redirige a `/` las rutas de
// tienda (`/catalog`, `/product/*`, `/cart`), `app/page.tsx` sirve la landing
// del studio y `shared/config/navigation.ts` expone una navegación reducida.
// Apagarlo devuelve la tienda completa: nada se ha borrado.
//
// Ojo: Next inlinea las `NEXT_PUBLIC_*` en tiempo de build, así que cambiar el
// valor (en Vercel o en `.env.local`) exige rebuild/reinicio del dev server.
export const LAUNCH_MODE = process.env.NEXT_PUBLIC_LAUNCH_MODE === "true";
