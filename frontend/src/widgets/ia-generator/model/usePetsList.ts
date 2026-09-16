"use client";

import { useEffect, useState } from "react";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { useAuth } from "@/context/AuthContext";
import type { Pet } from "../ui/upload-step/types";

function toPetList(res: unknown): Pet[] {
  if (Array.isArray(res)) return res as Pet[];
  const data = (res as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Pet[]) : [];
}

/**
 * Mascotas del usuario autenticado.
 *
 * El gate por `isAuthenticated` no es cosmético: sin sesión, `GET /pets` responde
 * 401, `fetchWithRefresh` intenta refrescar, el refresh también falla y acaba
 * haciendo `window.location.href = "/login"` (`lib/auth/fetch-with-refresh.ts`).
 * En el flujo de lanzamiento eso expulsaría al visitante del embudo y le borraría
 * la foto que acaba de subir. Mismo criterio que `hooks/useCredits.ts`.
 */
export function usePetsList() {
  const { get } = useAuthFetch();
  const { isAuthenticated } = useAuth();
  const [loaded, setLoaded] = useState<Pet[]>([]);

  // Sin sesión la lista se deriva vacía en vez de vaciarse con `setState`, para
  // que el efecto nunca llame a setState de forma síncrona.
  const pets = isAuthenticated ? loaded : [];

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    get<unknown>("/pets")
      .then((res) => {
        if (!cancelled) setLoaded(toPetList(res));
      })
      .catch(() => {
        // Silencioso: sin lista, el usuario simplemente crea una mascota nueva.
      });

    return () => {
      cancelled = true;
    };
  }, [get, isAuthenticated]);

  return { pets, setPets: setLoaded };
}
