import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LAUNCH_MODE } from '@/shared/config/launch';

/**
 * Rutas visibles en modo lanzamiento (§3.2 de LAUNCH_PLAN.md). Todo lo demás
 * —`/catalog`, `/product/*`, `/cart`, rutas inexistentes— redirige a `/`.
 * `/api/*` no está en la lista porque queda fuera del `matcher`.
 *
 * `/login` (y `/signin`, que no existe) también quedan fuera: en lanzamiento el
 * acceso es con el popup de Google in situ (`hooks/useGoogleSignIn.ts`).
 */
const LAUNCH_ALLOWED_PREFIXES = [
  '/create',
  '/admin-login',
  '/user',
  '/credits',
  '/admin',
  '/privacy',
  '/terms',
  '/shipping-returns',
  '/opengraph-image',
];

/** Rutas que exigen sesión (y rol admin en `/admin`), con o sin lanzamiento. */
const AUTH_PREFIXES = ['/user', '/admin'];

// El `/` final es lo que evita que un prefijo autorice de más: `/user` no debe
// abrir `/users-something`.
function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded?.role ?? null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Gate de lanzamiento ──
  // Aplica a todas las rutas y no mira la sesión: es solo visibilidad.
  if (LAUNCH_MODE) {
    // `/studio-landing` es la única ruta que se retira de verdad: su contenido
    // ahora vive en `/`, así que el redirect es permanente.
    if (pathname === '/studio-landing') {
      return NextResponse.redirect(new URL('/', request.url), 301);
    }

    if (!matchesPrefix(pathname, LAUNCH_ALLOWED_PREFIXES) && pathname !== '/') {
      // 307 (temporal) a propósito: las rutas de tienda vuelven al apagar el
      // flag, y un 301 se quedaría cacheado en el navegador de los visitantes.
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ── 2. Gate de auth ──
  if (!matchesPrefix(pathname, AUTH_PREFIXES)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken');

  if (!accessToken) {
    // En lanzamiento no hay /login: se vuelve a la landing, cuyo navbar ofrece
    // "Sign up" con Google.
    if (LAUNCH_MODE) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin')) {
    const role = getJwtRole(accessToken.value);
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Todo el sitio salvo el route handler de Shopify, los internos de Next y
    // cualquier fichero con extensión (`/process/1. Upload Picture.png`, …).
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
