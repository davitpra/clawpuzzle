"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import type { GeneratePayload } from "@/hooks/useGenerateImage";
import type {
  ApiEnvelope,
  PaginatedResult,
  UserGenerationDetail,
} from "@/entities/order/types";

/** Un retrato de la cuenta que se puede pedir tal cual. */
export interface ReusablePortrait {
  generationId: string;
  imageUrl: string;
  thumbnailUrl: string;
  styleId: string | null;
  styleName: string | null;
  petName: string | null;
  /**
   * Lo necesario para regenerarlo (otro estilo, reintento) sin subir la foto.
   * null en retratos antiguos sin foto o sin producto guardados.
   */
  payload: GeneratePayload | null;
}

type ListedGeneration = UserGenerationDetail & {
  petId?: string | null;
  petPhotoId?: string | null;
  styleId?: string | null;
};

/** Tope del backend por página; se piden páginas hasta tenerlos todos. */
const PAGE_SIZE = 100;
/** Freno por si `totalPages` no llega a cuadrar: 2000 retratos sobran. */
const MAX_PAGES = 20;

export function toReusablePortrait(
  g: ListedGeneration,
): ReusablePortrait | null {
  if (g.status !== "completed" || !g.resultUrl) return null;
  const styleId = g.styleId ?? g.style?.id ?? null;
  return {
    generationId: g.id,
    imageUrl: g.resultUrl,
    thumbnailUrl: g.thumbnailUrl ?? g.resultUrl,
    styleId,
    styleName: g.style?.displayName ?? null,
    petName: g.pet?.name ?? null,
    payload:
      g.petId && g.petPhotoId && g.formatId && g.productRefId && styleId
        ? {
            petId: g.petId,
            petPhotoId: g.petPhotoId,
            formatId: g.formatId,
            productRefId: g.productRefId,
            styleId,
          }
        : null,
  };
}

/**
 * Retratos terminados de la cuenta del mismo formato que el rompecabezas (la
 * proporción tiene que coincidir con la impresión). Solo con cuenta: al
 * invitado no se le hace ninguna llamada autenticada (ver CLAUDE.md).
 */
export function useReusablePortraits(formatId: string | null) {
  const { isAuthenticated } = useAuth();
  const { get } = useAuthFetch();
  const [state, setState] = useState<{
    key: string | null;
    portraits: ReusablePortrait[];
  }>({ key: null, portraits: [] });

  const key = isAuthenticated && formatId ? formatId : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    // El carrusel muestra todos los retratos de la cuenta, no solo los últimos.
    const loadAll = async () => {
      const all: ListedGeneration[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await get<ApiEnvelope<PaginatedResult<ListedGeneration>>>(
          `/generations?status=completed&limit=${PAGE_SIZE}&page=${page}`,
        );
        all.push(...(res.data?.data ?? []));
        if (page >= (res.data?.meta?.totalPages ?? 0)) break;
      }
      return all;
    };
    loadAll()
      .then((generations) => {
        if (cancelled) return;
        const portraits = generations
          .filter((g) => g.formatId === key)
          .map(toReusablePortrait)
          .filter((p): p is ReusablePortrait => p !== null);
        setState({ key, portraits });
      })
      .catch(() => {
        // Sin la lista la fila simplemente no aparece.
        if (!cancelled) setState({ key, portraits: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [key, get]);

  return state.key === key && key ? state.portraits : [];
}
