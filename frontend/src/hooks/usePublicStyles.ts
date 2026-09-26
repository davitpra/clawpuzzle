"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPublicStyles,
  type PublicStyle,
} from "@/entities/art-style/api/fetchPublicStyles";

interface UsePublicStylesResult {
  styles: PublicStyle[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

// Como en `useStyle`, el resultado lleva la versión de la petición que lo
// produjo: `isLoading` sale de comparar versiones y el efecto no llama setState
// de forma síncrona (react-hooks/set-state-in-effect).
interface PublicStylesState {
  version: number;
  styles: PublicStyle[];
  error: string | null;
}

/**
 * Estilos activos del catálogo público (`GET /styles`, sin sesión), para el
 * paso de estilo de `/create`: se puede llamar antes del login.
 */
export function usePublicStyles(): UsePublicStylesResult {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<PublicStylesState>({
    version: -1,
    styles: [],
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetchPublicStyles()
      .then((styles) => {
        if (!cancelled) setState({ version, styles, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("usePublicStyles error:", err);
        setState({ version, styles: [], error: "No se pudieron cargar los estilos." });
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const settled = state.version === version;

  return {
    styles: settled ? state.styles : [],
    isLoading: !settled,
    error: settled ? state.error : null,
    reload,
  };
}
