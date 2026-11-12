"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "./track";

/**
 * Una vista por carga y por cambio de ruta. Sin `useSearchParams` (obligaría a
 * un `<Suspense>`); los UTM los toma `trackPageView` de `location.href`.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  // StrictMode ejecuta el efecto dos veces en dev; el ref sobrevive y evita
  // la vista duplicada.
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    const firstLoad = lastPath.current === null;
    lastPath.current = pathname;
    trackPageView(pathname, { firstLoad });
  }, [pathname]);

  return null;
}
