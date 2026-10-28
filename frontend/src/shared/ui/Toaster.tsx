"use client";

import { Toaster as SonnerToaster } from "sonner";

// Toaster global (tienda y admin). Se dispara con `toast.success()` /
// `toast.error()` importando `toast` de "sonner" desde cualquier componente.
// Toast para eventos (guardado, error de una acción); los estados
// persistentes de una pantalla siguen siendo avisos en línea.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      richColors
      duration={4000}
      toastOptions={{
        style: {
          fontFamily: "var(--font-body)",
          background: "var(--color-cream)",
          color: "var(--color-text-main)",
          borderRadius: "12px",
        },
      }}
    />
  );
}
