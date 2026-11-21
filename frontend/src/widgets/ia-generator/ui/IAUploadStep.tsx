"use client";

import { usePhotoManager } from "./upload-step/usePhotoManager";
import { usePetUploadForm } from "./upload-step/usePetUploadForm";
import { PhotoUploadPanel } from "./upload-step/PhotoUploadPanel";
import { PetDetailsForm } from "./upload-step/PetDetailsForm";
import { MAX_PHOTOS, type IAUploadStepProps, type Pet } from "./upload-step/types";
import { useAuth } from "@/context/AuthContext";

const PET_FORM_ID = "pet-form";

/**
 * Primer paso del flujo de generación de IA.
 *
 * Permite subir fotos de la mascota (o reusar una existente) y editar sus
 * datos. Al continuar, guarda/actualiza la mascota, sube las fotos, dispara la
 * generación y agrega el resultado al carrito.
 *
 * La lógica vive en dos hooks: `usePhotoManager` (fotos + drag & drop) y
 * `usePetUploadForm` (mascotas, formulario y envío). La UI se divide en
 * `PhotoUploadPanel` (izquierda) y `PetDetailsForm` (derecha).
 */
export function IAUploadStep({
  photos,
  onPhotosChange,
  styleId,
  productRefId,
  formatId,
  onNext,
  productInfo,
  styleName,
  userSelections,
}: IAUploadStepProps) {
  const { isAdmin } = useAuth();

  const {
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
  } = usePetUploadForm({
    photos,
    styleId,
    productRefId,
    formatId,
    onNext,
    productInfo,
    styleName,
    userSelections,
  });

  // Las fotos guardadas cuentan para las 4: solo caben las que faltan.
  const maxNewPhotos = Math.max(0, MAX_PHOTOS - existingPhotos.length);

  const {
    previews,
    isDragging,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInput,
    removePhoto,
    makePrimary,
  } = usePhotoManager(photos, onPhotosChange, maxNewPhotos);

  const photoCount = existingPhotos.length + photos.length;
  const hasPhoto = photoCount > 0;
  const hasParams = !!(styleId && productRefId && formatId);

  // Si ya había fotos nuevas, se recortan a las que caben junto a las guardadas.
  const handleSelectPet = (pet: Pet) => {
    selectPet(pet);
    const room = Math.max(0, MAX_PHOTOS - (pet.photos?.length ?? 0));
    if (photos.length > room) onPhotosChange(photos.slice(0, room));
  };

  return (
    <main className="grow flex flex-col px-6 py-8 md:py-10 animate-in fade-in duration-500">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">
        {!isAdmin && creditBalance !== null && (
          <div className="mb-4 flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <span className="material-symbols-outlined text-base leading-none">
                auto_awesome
              </span>
              {creditBalance} {creditBalance === 1 ? "crédito disponible" : "créditos disponibles"}
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-12 items-stretch flex-1 min-h-0">
          <PhotoUploadPanel
            previews={previews}
            isDragging={isDragging}
            existingPhotos={existingPhotos.map((p) => p.photoUrl)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onFileInput={handleFileInput}
            onRemovePhoto={removePhoto}
            onMakePrimary={makePrimary}
            onRemoveExistingPhoto={removeExistingPhoto}
            onMakeExistingPrimary={makeExistingPrimary}
          />

          <PetDetailsForm
            formId={PET_FORM_ID}
            pets={pets}
            activePet={activePet}
            isExistingPet={isExistingPet}
            form={form}
            formError={formError}
            outOfCredits={outOfCredits}
            hasPhoto={hasPhoto}
            hasParams={hasParams}
            submitting={submitting}
            onSubmit={handleSubmit}
            onFieldChange={handleFieldChange}
            onSelectPet={handleSelectPet}
            onResetPet={resetPet}
          />
        </div>
      </div>
    </main>
  );
}
