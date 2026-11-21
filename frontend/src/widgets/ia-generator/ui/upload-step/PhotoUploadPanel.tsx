"use client";

import { MAX_PHOTOS } from "./types";

// Formatos que el backend acepta. Listarlos (en vez de `image/*`) hace que iOS
// convierta las fotos HEIC a JPEG al elegirlas desde la galería.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";


// Calidad esperada según la cantidad de fotos (no analiza las fotos en sí).
function qualityOf(count: number) {
  if (count >= MAX_PHOTOS) return { label: "Excelente", className: "bg-emerald-50 text-emerald-700" };
  if (count >= 2) return { label: "Buena", className: "bg-primary/10 text-primary" };
  return { label: "Aceptable", className: "bg-amber-50 text-amber-700" };
}

interface PhotoUploadPanelProps {
  previews: string[];
  isDragging: boolean;
  existingPhotos: string[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onMakePrimary: (index: number) => void;
  onRemoveExistingPhoto: (index: number) => void;
  onMakeExistingPrimary: (index: number) => void;
}

type Thumb =
  | { kind: "existing"; src: string; index: number }
  | { kind: "upload"; src: string; index: number };

/**
 * Columna izquierda del paso de subida: pide 4 fotos con una cuadrícula 2x2
 * (cada espacio vacío pide ser llenado) y muestra el progreso. Cualquier foto
 * de la mascota vale; las fotos se colocan en orden y al quitar una las demás
 * se corren a la izquierda.
 *
 * Las fotos guardadas de la mascota cuentan para las 4 y van primero; la
 * primera de la cuadrícula es la principal.
 */
export function PhotoUploadPanel({
  previews,
  isDragging,
  existingPhotos,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInput,
  onRemovePhoto,
  onMakePrimary,
  onRemoveExistingPhoto,
  onMakeExistingPrimary,
}: PhotoUploadPanelProps) {
  const thumbs: Thumb[] = [
    ...existingPhotos.map((src, index) => ({ kind: "existing" as const, src, index })),
    ...previews.map((src, index) => ({ kind: "upload" as const, src, index })),
  ].slice(0, MAX_PHOTOS);

  const count = thumbs.length;
  const atMax = count >= MAX_PHOTOS;
  const hasExisting = existingPhotos.length > 0;
  const quality = count > 0 ? qualityOf(count) : null;

  const removeThumb = (thumb: Thumb) => {
    if (thumb.kind === "upload") {
      onRemovePhoto(thumb.index);
      return;
    }
    // Borra la foto guardada de verdad: se pide confirmación.
    if (window.confirm("¿Borrar esta foto? Se eliminará de tu mascota.")) {
      onRemoveExistingPhoto(thumb.index);
    }
  };

  // Con fotos guardadas, la principal es una de ellas: las nuevas no compiten.
  const canMakePrimary = (thumb: Thumb) =>
    thumb.kind === "existing" || !hasExisting;

  const makePrimary = (thumb: Thumb) =>
    thumb.kind === "existing"
      ? onMakeExistingPrimary(thumb.index)
      : onMakePrimary(thumb.index);

  return (
    <div className="flex flex-col">
      <h2 className="font-display text-xl font-black text-slate-dark">
        Sube {MAX_PHOTOS} fotos de tu mascota
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Con {MAX_PHOTOS} fotos el retrato se parece mucho más a tu mascota.
      </p>

      {/* Progreso: cuántas fotos van y la calidad esperada */}
      <div className="mt-4 mb-3" aria-live="polite">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-dark">
            {count} de {MAX_PHOTOS} fotos
          </span>
          {quality && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${quality.className}`}
            >
              Calidad: {quality.label}
            </span>
          )}
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Fotos subidas"
          aria-valuemin={0}
          aria-valuemax={MAX_PHOTOS}
          aria-valuenow={count}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(count / MAX_PHOTOS) * 100}%` }}
          />
        </div>
      </div>

      {/* Input compartido: lo abren todos los espacios vacíos */}
      <input
        id="pet-photos-input"
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        disabled={atMax}
        aria-label="Subir fotos de tu mascota"
        className="peer sr-only"
        onChange={onFileInput}
      />

      {/* Cuadrícula 2x2: un espacio por foto. Con teclado, el foco
          va al input oculto y se marca la cuadrícula entera. */}
      <div
        className={`grid grid-cols-2 gap-3 rounded-xl transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-4 ${
          isDragging ? "ring-2 ring-primary ring-offset-4" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {Array.from({ length: MAX_PHOTOS }, (_, i) => {
          const thumb = thumbs[i];

          if (!thumb) {
            const isNext = i === count;
            return (
              <label
                key={`slot-${i}`}
                htmlFor="pet-photos-input"
                className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-2 text-center transition-all ${
                  isNext
                    ? "border-primary bg-primary/5 text-primary shadow-sm hover:shadow-md"
                    : "border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:text-primary"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`material-symbols-outlined text-[32px] ${isNext ? "animate-pulse" : ""}`}
                >
                  add_a_photo
                </span>
                <span className="text-sm font-bold leading-tight">Foto {i + 1}</span>
                {isNext && (
                  <span className="text-xs font-semibold text-primary/80">
                    {count === 0 ? "Toca para subir" : "Siguiente"}
                  </span>
                )}
              </label>
            );
          }

          const isPrimary = i === 0;
          // Tocar la foto la vuelve principal (si puede serlo).
          const selectable = !isPrimary && canMakePrimary(thumb);
          return (
            <div
              key={`${thumb.kind}-${thumb.src}`}
              className={`group/thumb relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 ${
                isPrimary ? "border-primary" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.src}
                alt={`Foto ${i + 1} de tu mascota`}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${
                  selectable ? "group-hover/thumb:scale-105" : ""
                }`}
              />

              {selectable && (
                <button
                  type="button"
                  onClick={() => makePrimary(thumb)}
                  title="Hacer principal"
                  aria-label={`Hacer la foto ${i + 1} principal`}
                  className="absolute inset-0 cursor-pointer bg-transparent transition-all hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                />
              )}

              {isPrimary && (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white pointer-events-none">
                  Principal
                </span>
              )}

              <button
                type="button"
                onClick={() => removeThumb(thumb)}
                title="Quitar foto"
                aria-label="Quitar foto"
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-red-500"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>

            </div>
          );
        })}
      </div>

      <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-slate-500">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[14px] text-amber-400"
        >
          lightbulb
        </span>
        Todas las fotos deben ser de la misma mascota.
      </p>
    </div>
  );
}
