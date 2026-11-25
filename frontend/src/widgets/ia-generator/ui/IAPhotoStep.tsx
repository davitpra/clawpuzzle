"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useAuth } from "@/context/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { usePhotoManager } from "./upload-step/usePhotoManager";
import { PhotoUploadPanel } from "./upload-step/PhotoUploadPanel";
import { IAStyleBanner } from "./IAStyleBanner";
import { usePetsList } from "../model/usePetsList";
import { useExistingPetPhotos } from "../model/useExistingPetPhotos";
import { MAX_PHOTOS, type Pet, type PetPhoto } from "./upload-step/types";

interface IAPhotoStepProps {
  styleName: string | null;
  styleImg: string | null;
  photos: File[];
  onPhotosChange: (files: File[]) => void;
  petName: string;
  onPetNameChange: (name: string) => void;
  activePet: Pet | null;
  onSelectPet: (pet: Pet | null) => void;
  onContinue: () => void;
  onChangeStyle: () => void;
  /** Ver `IAStyleBanner`: con `null`, "Cambiar" no navega. */
  changeStyleHref?: string | null;
  /** Fila sobre el estilo, en la misma tarjeta; p. ej. el progreso del pedido. */
  progress?: ReactNode;
  /** Sobre la tarjeta del estilo; p. ej. el aviso de vistas previas del pedido. */
  notice?: ReactNode;
  /** Texto del botón; por defecto "Continuar". */
  continueLabel?: string;
  submitting: boolean;
  error: string | null;
  outOfCredits: boolean;
}

/**
 * Primer paso del embudo de lanzamiento: la foto, **antes** de pedir cuenta.
 *
 * Reglas de oro de este paso:
 * 1. Sin sesión no se hace **ninguna** llamada autenticada. `usePetsList` y
 *    `useCredits` se gatean solos por `isAuthenticated` (falso también para un
 *    invitado, que sí tiene sesión: ver `hasSession`); un 401 aquí acabaría en
 *    el `window.location.href = "/login"` de `fetchWithRefresh` y el visitante
 *    perdería la foto recién subida.
 * 2. Solo se piden foto y nombre. Raza y edad se editan luego desde `/user`:
 *    cada campo extra antes del registro es fricción en la puerta principal. La
 *    especie no se pregunta: el VLM ve la foto y deduce el animal por sí solo.
 */
export function IAPhotoStep({
  styleName,
  styleImg,
  photos,
  onPhotosChange,
  petName,
  onPetNameChange,
  activePet,
  onSelectPet,
  onContinue,
  onChangeStyle,
  changeStyleHref,
  progress = null,
  notice = null,
  continueLabel = "Continuar",
  submitting,
  error,
  outOfCredits,
}: IAPhotoStepProps) {
  const { isAuthenticated, isAdmin, isGuest } = useAuth();
  // El invitado que ya usó su imagen gratis no compra créditos: se registra.
  const { signIn, pending: signingIn } = useGoogleSignIn();
  const { balance: creditBalance } = useCredits();
  const { pets, setPets } = usePetsList();

  // Mantiene la mascota activa (y la lista) al día cuando se borran o reordenan
  // sus fotos guardadas: el envío y el `photo_count` leen `activePet.photos`.
  const syncPetPhotos = useCallback(
    (petId: string, petPhotos: PetPhoto[]) => {
      if (activePet?.id === petId) onSelectPet({ ...activePet, photos: petPhotos });
      setPets((prev) =>
        prev.map((p) => (p.id === petId ? { ...p, photos: petPhotos } : p)),
      );
    },
    [activePet, onSelectPet, setPets],
  );

  const { existingPhotos, removeExistingPhoto, makeExistingPrimary } =
    useExistingPetPhotos(activePet, syncPetPhotos);

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
  const hasName = petName.trim().length > 0;
  const canContinue = hasPhoto && hasName && !submitting;

  const hint = !hasPhoto
    ? "Sube al menos una foto de tu mascota para continuar"
    : !hasName
      ? "Cuéntanos cómo se llama tu mascota para continuar"
      : null;

  const selectPet = (pet: Pet) => {
    onSelectPet(pet);
    onPetNameChange(pet.name);
    // Si ya había fotos nuevas, se recortan a las que caben junto a las guardadas.
    const room = Math.max(0, MAX_PHOTOS - (pet.photos?.length ?? 0));
    if (photos.length > room) onPhotosChange(photos.slice(0, room));
  };

  const clearPet = () => {
    onSelectPet(null);
    onPetNameChange("");
  };

  return (
    <main className="grow flex flex-col px-6 py-8 md:py-10 animate-in fade-in duration-500">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">
        {notice}
        <IAStyleBanner
          styleName={styleName}
          styleImg={styleImg}
          onChangeStyle={onChangeStyle}
          changeStyleHref={changeStyleHref}
          top={progress}
        />

        {isAuthenticated && !isAdmin && creditBalance !== null && (
          <div className="mb-4 flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <span className="material-symbols-outlined text-base leading-none">
                auto_awesome
              </span>
              {creditBalance} {creditBalance === 1 ? "vista previa disponible" : "vistas previas disponibles"}
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

          <div>
            <h2 className="font-display text-xl font-black text-slate-dark mb-4">
              Tu mascota
            </h2>

            {/* Reutilizar una mascota ya subida: solo tiene sentido con sesión. */}
            {isAuthenticated && pets.length > 0 && !activePet && (
              <div className="mb-4">
                <p className="mb-2 text-sm text-slate-dark/60">
                  O elige una que ya subiste:
                </p>
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => selectPet(pet)}
                      className="rounded-lg border border-[#E5E0D8] bg-white px-3 py-2 text-sm font-semibold text-slate-dark transition-colors hover:bg-gray-50"
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activePet && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  check_circle
                </span>
                <span className="text-sm font-semibold text-primary">
                  {activePet.name} seleccionado
                </span>
                <button
                  type="button"
                  onClick={clearPet}
                  className="ml-auto bg-transparent text-xs text-slate-500 underline hover:text-slate-700"
                >
                  Usar otra mascota
                </button>
              </div>
            )}

            <label
              htmlFor="pet-name"
              className="mb-1.5 block text-sm font-bold text-slate-dark"
            >
              Nombre de tu mascota
            </label>
            <input
              id="pet-name"
              name="petName"
              type="text"
              value={petName}
              onChange={(e) => onPetNameChange(e.target.value)}
              placeholder="Luna"
              maxLength={100}
              autoComplete="off"
              className="w-full rounded-lg border border-primary bg-white px-5 py-3.5 text-base text-slate-dark placeholder-gray-400 transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
                {outOfCredits && isGuest && (
                  <button
                    type="button"
                    onClick={signIn}
                    disabled={signingIn}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      auto_awesome
                    </span>
                    {signingIn
                      ? "Abriendo Google…"
                      : "Registrarme y recibir 4 vistas previas"}
                  </button>
                )}
                {outOfCredits && !isGuest && (
                  <Link
                    href="/credits"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      auto_awesome
                    </span>
                    Conseguir más vistas previas
                  </Link>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue}
              aria-busy={submitting}
              className={`mt-5 w-full rounded-xl py-3.5 text-base font-bold transition-all ${
                canContinue
                  ? "bg-primary text-white shadow-md hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-lg"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              {submitting ? "Creando tu arte…" : continueLabel}
            </button>
            {hint && (
              <p className="mt-2 text-center text-xs text-slate-400">{hint}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
