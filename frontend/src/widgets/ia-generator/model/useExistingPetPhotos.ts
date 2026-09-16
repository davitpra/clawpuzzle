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

  // Quita una foto guardada solo de la vista (no la borra del backend).
  const removeExistingPhoto = useCallback(
    (index: number) => {
      if (!petId) return;
      setEdits({
        petId,
        photos: existingPhotos.filter((_, i) => i !== index),
      });
    },
    [petId, existingPhotos],
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
