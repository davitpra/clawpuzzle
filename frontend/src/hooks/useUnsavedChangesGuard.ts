"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Retiene la navegación mientras haya cambios sin guardar.
//
// - Clics en enlaces internos (`next/link` y los `<a>` de Polaris): se cancelan
//   y la ruta destino queda en `pendingHref` para que la página pregunte.
// - Cerrar o recargar la pestaña: diálogo nativo del navegador (no admite
//   botones propios).
// - Navegaciones por código: pasarlas por `requestNavigation`.
//
// El botón "atrás" del navegador no se intercepta: el App Router no expone un
// evento cancelable para eso.
export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(isDirty);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    // Fase de captura en `document`: corre antes que el listener raíz de React,
    // así el `onClick` de `next/link` nunca llega a navegar.
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;
      const anchor = e.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const requestNavigation = useCallback(
    (href: string) => {
      if (dirtyRef.current) setPendingHref(href);
      else router.push(href);
    },
    [router],
  );

  const cancelNavigation = useCallback(() => setPendingHref(null), []);

  const confirmNavigation = useCallback(() => {
    if (!pendingHref) return;
    dirtyRef.current = false;
    setPendingHref(null);
    router.push(pendingHref);
  }, [pendingHref, router]);

  return { pendingHref, requestNavigation, cancelNavigation, confirmNavigation };
}
