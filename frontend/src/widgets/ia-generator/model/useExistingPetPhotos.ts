"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { orderedPhotos, type Pet, type PetPhoto } from "../ui/upload-step/types";

interface EditState {
  petId: string | null;
  photos: PetPhoto[];
}

/**
 * Fotos ya guardadas de la mascota seleccionada, con la principal primero.
 *
 * El estado local solo guarda las ediciones del usuario; mientras su `petId` no
 * coincida con la mascota activa, la lista se deriva de la propia mascota. Así
 * cambiar de mascota resetea la vista sin llamar a `setState` desde un efecto
 * (mismo patrón que `hooks/useStyle.ts`).
 */
export function useExistingPetPhotos(
  activePet: Pet | null,
  onPetPhotosChange?: (petId: string, photos: PetPhoto[]) => void,
) {
  const { authFetchJSON } = useAuthFetch();
  const [edits, setEdits] = useState<EditState>({ petId: null, photos: [] });

  const petId = activePet?.id ?? null;
  const existingPhotos = useMemo(
    () =>
      petId !== null && edits.petId === petId
        ? edits.photos
        : activePet
          ? orderedPhotos(activePet)
          : [],
    [petId, edits, activePet],
  );

  // Borra una foto guardada del backend (y de S3). El modelo usa todas las fotos
  // de la mascota y el backend topa en MAX_PET_PHOTOS, así que ocultarla solo en
  // la vista dejaría al contador mintiendo. Los retratos que la usaban no se
  // rompen: `generation.petPhotoId` es `onDelete: SetNull`.
  const removeExistingPhoto = useCallback(
    async (index: number) => {
      if (!petId) return;
      const target = existingPhotos[index];
      if (!target) return;

      const previous = existingPhotos;
      let remaining = existingPhotos.filter((_, i) => i !== index);
      // El backend no reasigna la principal al borrarla: se promueve la siguiente.
      const promoted =
        target.isPrimary && remaining.length > 0 ? remaining[0] : null;
      if (promoted) {
        remaining = remaining.map((p) => ({ ...p, isPrimary: p.id === promoted.id }));
      }

      setEdits({ petId, photos: remaining });
      onPetPhotosChange?.(petId, remaining);

      try {
        await authFetchJSON(`/pets/${petId}/photos/${target.id}`, {
          method: "DELETE",
        });
      } catch {
        // Revierte si el backend falla: la foto sigue guardada.
        setEdits({ petId, photos: previous });
        onPetPhotosChange?.(petId, previous);
        return;
      }

      if (promoted) {
        try {
          await authFetchJSON(`/pets/${petId}/photos/${promoted.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_primary: true }),
          });
        } catch {
          // Sin principal marcada el backend sigue funcionando: `primaryPhotoOf`
          // cae en la primera foto y la generación envía su id explícitamente.
        }
      }
    },
    [petId, existingPhotos, authFetchJSON, onPetPhotosChange],
  );

  // Marca una foto guardada como principal: lo persiste y reordena localmente.
  const makeExistingPrimary = useCallback(
    async (index: number) => {
      if (!petId) return;
      const target = existingPhotos[index];
      if (!target || target.isPrimary) return;

      const reordered = existingPhotos
        .map((p) => ({ ...p, isPrimary: p.id === target.id }))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

      const previous = existingPhotos;
      setEdits({ petId, photos: reordered });
      onPetPhotosChange?.(petId, reordered);

      try {
        await authFetchJSON(`/pets/${petId}/photos/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_primary: true }),
        });
      } catch {
        // Revierte si el backend falla.
        setEdits({ petId, photos: previous });
        onPetPhotosChange?.(petId, previous);
      }
    },
    [petId, existingPhotos, authFetchJSON, onPetPhotosChange],
  );

  return { existingPhotos, removeExistingPhoto, makeExistingPrimary };
}
