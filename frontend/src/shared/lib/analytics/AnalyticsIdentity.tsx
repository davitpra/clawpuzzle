"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { useAuth } from "@/context/AuthContext";
import { nextIdentityAction } from "./identity";
import { clearUser, flushAuthEvent, identifyUser } from "./track";

/**
 * Coincidencia avanzada (TRACKING.md, paso 4): manda email + id a Meta (y el
 * id a GA4) y usa el id estable para identificar a la persona en PostHog
 * cuando hay sesión, tanto tras un login como al volver con la sesión abierta
 * (`checkAuth`). Así Meta une la visita con el `Purchase` del checkout de
 * Shopify, que está en otro dominio.
 *
 * También vacía la cola del evento de login (`queueAuthEvent`).
 *
 * Montar dentro de `<AuthProvider>`, en `app/layout.tsx`.
 */
export function AnalyticsIdentity() {
  const { user, isLoading } = useAuth();
  // Sobrevive al doble efecto de StrictMode y a cada `setUser` con el mismo
  // usuario: la identificación sale una vez por cuenta (y otra si un invitado
  // se registra y gana email).
  const identifiedKey = useRef<string | null>(null);
  const identifiedUserId = useRef<string | null>(null);

  const id = user?.id;
  const email = user?.email;
  const role = user?.role;
  const fullName = user?.fullName;

  useEffect(() => {
    const action = nextIdentityAction(
      identifiedKey.current,
      id && email ? { id, email, role } : null,
      isLoading,
    );
    if (action.type === "identify") {
      if (identifiedUserId.current && identifiedUserId.current !== action.id) {
        posthog.reset();
      }
      identifyUser({ id: action.id, email: action.email });
      posthog.identify(action.id, {
        role: role ?? "user",
        ...(role !== "guest" && email ? { email } : {}),
        ...(fullName ? { name: fullName } : {}),
      });
      identifiedKey.current = action.key;
      identifiedUserId.current = action.id;
    } else if (action.type === "clear") {
      clearUser();
      posthog.reset();
      identifiedKey.current = null;
      identifiedUserId.current = null;
    }
    // El `sign_up`/`login` que dejó `AuthContext` sale ya identificado.
    if (identifiedKey.current) flushAuthEvent();
  }, [id, email, role, fullName, isLoading]);

  return null;
}
