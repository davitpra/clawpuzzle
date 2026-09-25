"use client";

import { useState, useCallback } from "react";
import { useCredits } from "@/hooks/useCredits";
import { usePetsList } from "../../model/usePetsList";
import { useCreateGeneration } from "../../model/useCreateGeneration";
import { useExistingPetPhotos } from "../../model/useExistingPetPhotos";
import {
  EMPTY_FORM,
  petToForm,
  type Pet,
  type PetPhoto,
  type PetForm,
  type IAUploadStepProps,
} from "./types";

type UploadFormDeps = Pick<
  IAUploadStepProps,
  | "photos"
  | "styleId"
  | "productRefId"
  | "formatId"
  | "onNext"
  | "productInfo"
  | "styleName"
  | "userSelections"
>;

/**
 * Maneja las mascotas del usuario, el estado del formulario y el envío.
 *
 * El pipeline de guardado/subida/generación vive en `useCreateGeneration` y la
 * lista de mascotas en `usePetsList`: este hook solo aporta el estado del
 * formulario y los conecta. Es el flujo clásico (entrada desde ficha de
 * producto); el de lanzamiento usa esos mismos hooks por separado.
 */
export function usePetUploadForm({
  photos,
  styleId,
  productRefId,
  formatId,
  onNext,
  productInfo,
  styleName,
  userSelections,
}: UploadFormDeps) {
  const { balance: creditBalance } = useCredits();
  const { pets, setPets } = usePetsList();
  const {
    submit,
    submitting,
    error: submitError,
    outOfCredits,
    reset: resetSubmitError,
  } = useCreateGeneration();

  const [activePet, setActivePet] = useState<Pet | null>(null);
  const [form, setForm] = useState<PetForm>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isExistingPet = activePet !== null;
  const formError = validationError ?? submitError;

  // Mantiene sincronizadas la mascota activa y la lista cuando se reordenan las
  // fotos guardadas.
  const syncPetPhotos = useCallback(
    (petId: string, photos: PetPhoto[]) => {
      setActivePet((prev) => (prev && prev.id === petId ? { ...prev, photos } : prev));
      setPets((prev) =>
        prev.map((p) => (p.id === petId ? { ...p, photos } : p)),
      );
    },
    [setPets],
  );

  const { existingPhotos, removeExistingPhoto, makeExistingPrimary } =
    useExistingPetPhotos(activePet, syncPetPhotos);

  const selectPet = useCallback((pet: Pet) => {
    setActivePet(pet);
    setForm(petToForm(pet));
  }, []);

  const resetPet = useCallback(() => {
    setActivePet(null);
    setForm(EMPTY_FORM);
  }, []);

  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);
      resetSubmitError();

      if (!isExistingPet && !form.name.trim()) {
        setValidationError("Pet name is required.");
        return;
      }
      if (!styleId || !productRefId || !formatId) {
        setValidationError(
          "Missing product or format info. Please start from the catalog link.",
        );
        return;
      }

      try {
        const { generationId, payload, pet } = await submit({
          photos,
          form,
          activePet,
          productRefId,
          formatId,
          styleId,
          userSelections,
          productInfo,
          styleName,
        });

        // Refleja en la vista la mascota creada o actualizada.
        setPets((prev) =>
          prev.some((p) => p.id === pet.id)
            ? prev.map((p) => (p.id === pet.id ? pet : p))
            : [...prev, pet],
        );
        setActivePet(pet);
        setForm(petToForm(pet));

        onNext(generationId, payload);
      } catch {
        // El mensaje ya quedó en `submitError`; aquí solo se evita el unhandled.
      }
    },
    [
      isExistingPet,
      form,
      styleId,
      productRefId,
      formatId,
      photos,
      activePet,
      userSelections,
      productInfo,
      styleName,
      submit,
      resetSubmitError,
      setPets,
      onNext,
    ],
  );

  return {
    pets,
    activePet,
    isExistingPet,
    form,
    existingPhotos,
    removeExistingPhoto,
    makeExistingPrimary,
    submitting,
    formError,
    outOfCredits,
    creditBalance,
    selectPet,
    resetPet,
    handleFieldChange,
    handleSubmit,
  };
}
