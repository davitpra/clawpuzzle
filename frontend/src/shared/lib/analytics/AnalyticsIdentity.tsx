"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { nextIdentityAction } from "./identity";
import { clearUser, flushAuthEvent, identifyUser } from "./track";

/**
 * Coincidencia avanzada (TRACKING.md, paso 4): manda email + id a Meta (y el
 * id a GA4) cuando hay sesión, tanto tras un login como al volver con la
 * sesión abierta (`checkAuth`). Así Meta une la visita con el `Purchase` del
 * checkout de Shopify, que está en otro dominio.
 *
 * También vacía la cola del evento de login (`queueAuthEvent`).
 *
 * Montar dentro de `<AuthProvider>`, en `app/layout.tsx`.
 */
export function AnalyticsIdentity() {
  const { user, isLoading } = useAuth();
  // Sobrevive al doble efecto de StrictMode y a cada `setUser` con el mismo
  // usuario: el `init` de Meta sale una vez por cuenta.
  const identifiedId = useRef<string | null>(null);

  const id = user?.id;
  const email = user?.email;
  const role = user?.role;

  useEffect(() => {
    const action = nextIdentityAction(
      identifiedId.current,
      id && email ? { id, email, role } : null,
      isLoading,
    );
    if (action.type === "identify") {
      identifyUser({ id: action.id, email: action.email });
      identifiedId.current = action.id;
    } else if (action.type === "clear") {
      clearUser();
      identifiedId.current = null;
    }
    // El `sign_up`/`login` que dejó `AuthContext` sale ya identificado.
    if (identifiedId.current) flushAuthEvent();
  }, [id, email, role, isLoading]);

  return null;
}
