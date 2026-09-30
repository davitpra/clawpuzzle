"use client";

import { useCallback, useState } from "react";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { useGenerateImage, type GeneratePayload } from "@/hooks/useGenerateImage";
import { useCredits } from "@/hooks/useCredits";
import { useCart } from "@/context/CartContext";
import { normalizeTemplate } from "@/entities/product/lib/template";
import type { SelectedProductInfo } from "./selectedProduct";
import { isOutOfCreditsError } from "./outOfCredits";
import {
  primaryPhotoOf,
  type Pet,
  type PetForm,
  type PetPhoto,
} from "../ui/upload-step/types";

// Desempaqueta respuestas que pueden venir envueltas en { data } o planas.
function unwrap<T>(raw: { data: T } | T): T {
  return raw && typeof raw === "object" && "data" in raw
    ? (raw as { data: T }).data
    : (raw as T);
}

export interface CreateGenerationInput {
  photos: File[];
  form: PetForm;
  /** Mascota existente a reutilizar, o null para crear una nueva. */
  activePet: Pet | null;
  productRefId: string;
  formatId: string;
  /** Estilo elegido; imprescindible con el producto de lanzamiento. */
  styleId: string;
  userSelections?: Record<string, string | number>;
  productInfo: SelectedProductInfo | null;
  styleName: string | null;
}

export interface CreateGenerationResult {
  generationId: string;
  payload: GeneratePayload;
  /** Mascota creada o actualizada, para refrescar la lista del formulario. */
  pet: Pet;
}

const NO_PHOTO_ERROR = "Agrega una foto de tu mascota para continuar.";

/**
 * Pipeline de creación: guarda la mascota, sube las fotos y dispara la
 * generación. Vive fuera del formulario a propósito — el flujo de lanzamiento lo
 * invoca desde el paso de cuenta, con la foto que ya estaba en memoria, mientras
 * que el flujo clásico lo llama desde el submit de `usePetUploadForm`.
 *
 * Todas sus llamadas son autenticadas: no invocar `submit()` sin sesión.
 */
export function useCreateGeneration() {
  const { post, authFetchJSON } = useAuthFetch();
  const { generate } = useGenerateImage();
  const { refresh: refreshCredits } = useCredits();
  const { addToCart } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // true cuando el fallo fue el 402 de saldo agotado: habilita el CTA a /credits.
  const [outOfCredits, setOutOfCredits] = useState(false);

  const reset = useCallback(() => {
    setError(null);
    setOutOfCredits(false);
  }, []);

  // Sube todas las fotos en orden: la primera como principal (isPrimary=true) y
  // el resto como secundarias. Devuelve la foto principal para usar su id.
  const uploadPhotos = useCallback(
    async (petId: string, photos: File[]): Promise<PetPhoto | null> => {
      let primaryPhoto: PetPhoto | null = null;
      for (let i = 0; i < photos.length; i++) {
        const formData = new FormData();
        formData.append("photo", photos[i]);
        const raw = await authFetchJSON<{ data: PetPhoto } | PetPhoto>(
          `/pets/${petId}/photos?isPrimary=${i === 0}`,
          { method: "POST", body: formData },
        );
        const photo = unwrap(raw);
        if (i === 0) primaryPhoto = photo;
      }
      return primaryPhoto;
    },
    [authFetchJSON],
  );

  // Crea o actualiza la mascota y devuelve la fila junto a la foto principal.
  const savePet = useCallback(
    async (
      form: PetForm,
      activePet: Pet | null,
      photos: File[],
    ): Promise<{ pet: Pet; petPhotoId: string | null }> => {
      const payload = {
        breed: form.breed.trim() || undefined,
        age: form.age ? parseInt(form.age) : undefined,
      };

      if (activePet) {
        const updated = unwrap(
          await authFetchJSON<{ data: Pet } | Pet>(`/pets/${activePet.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        );
        // Reutilizar mascota sin foto nueva: vale la principal ya guardada. El
        // backend topa en MAX_PET_PHOTOS = 4, así que no se sube por subir.
        const newPhoto = photos.length > 0
          ? await uploadPhotos(activePet.id, photos)
          : null;
        const existingPrimary = primaryPhotoOf(activePet);
        return {
          pet: updated,
          petPhotoId: newPhoto?.id ?? existingPrimary?.id ?? null,
        };
      }

      const newPet = unwrap(
        await post<{ data: Pet } | Pet>("/pets", {
          name: form.name.trim(),
          ...payload,
        }),
      );
      const newPhoto = await uploadPhotos(newPet.id, photos);
      return { pet: newPet, petPhotoId: newPhoto?.id ?? null };
    },
    [post, authFetchJSON, uploadPhotos],
  );

  const submit = useCallback(
    async (input: CreateGenerationInput): Promise<CreateGenerationResult> => {
      const {
        photos,
        form,
        activePet,
        productRefId,
        formatId,
        styleId,
        userSelections,
        productInfo,
        styleName,
      } = input;

      setSubmitting(true);
      setError(null);
      setOutOfCredits(false);

      try {
        if (photos.length === 0 && !(activePet && primaryPhotoOf(activePet))) {
          throw new Error(NO_PHOTO_ERROR);
        }

        const { pet, petPhotoId } = await savePet(form, activePet, photos);
        // `petPhotoId` es obligatorio en el DTO del backend (@IsUUID), así que sin
        // él la petición sería un 400 sin mensaje útil.
        if (!petPhotoId) throw new Error(NO_PHOTO_ERROR);

        // El payload se guarda para permitir reintentar la generación sin volver
        // a crear la mascota ni resubir las fotos.
        const payload: GeneratePayload = {
          petId: pet.id,
          petPhotoId,
          formatId,
          productRefId,
          styleId,
          userSelections:
            userSelections && Object.keys(userSelections).length > 0
              ? userSelections
              : undefined,
        };

        const generation = await generate(payload);

        // La generación consumió 1 crédito: refrescamos el saldo del badge.
        void refreshCredits();

        // Digital (descarga gratuita; "PBN" legacy) no va al carrito: no se cobra
        // ni debe disparar el order_bonus de +3 créditos en checkout.
        const isDigital = normalizeTemplate(productInfo?.template) === "Digital";
        if (productInfo && !isDigital) {
          try {
            addToCart({
              id: generation.id,
              variantId: productInfo.shopifyVariantId,
              name: productInfo.productTitle,
              size: productInfo.formatLabel,
              style: styleName ?? undefined,
              price: parseFloat(productInfo.price),
              quantity: 1,
              img: productInfo.productImage,
              generationId: generation.id,
            });
          } catch (cartErr) {
            console.error("addToCart failed:", cartErr);
          }
        }

        return { generationId: generation.id, payload, pet };
      } catch (err) {
        // Se propaga el mensaje del backend (p. ej. el 402 de créditos o el 400
        // de formato incompatible), que ya viene redactado para el usuario.
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "No se pudo crear el arte. Inténtalo de nuevo.";
        setError(msg);
        setOutOfCredits(isOutOfCreditsError(err));
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [savePet, generate, refreshCredits, addToCart],
  );

  return { submit, submitting, error, outOfCredits, reset };
}
