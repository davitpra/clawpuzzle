"use client";

interface ContinueButtonProps {
  formId: string;
  hasPhoto: boolean;
  hasName: boolean;
  hasParams: boolean;
  submitting: boolean;
  isExistingPet: boolean;
}

/**
 * Botón de envío del formulario con su estado deshabilitado y el texto de ayuda
 * que explica qué falta para poder continuar.
 */
export function ContinueButton({
  formId,
  hasPhoto,
  hasName,
  hasParams,
  submitting,
  isExistingPet,
}: ContinueButtonProps) {
  const needsPhoto = !hasPhoto;
  const needsName = !hasName;
  const missingParams = !hasParams;
  const disabled = needsPhoto || needsName || missingParams || submitting;

  const hint = missingParams
    ? "Falta el producto: vuelve a empezar desde el inicio"
    : needsPhoto && needsName
      ? "Sube una foto y escribe el nombre de tu mascota para continuar"
      : needsPhoto
        ? "Sube al menos una foto para continuar"
        : needsName
          ? "Escribe el nombre de tu mascota para continuar"
          : null;

  return (
    <>
      <button
        type="submit"
        form={formId}
        disabled={disabled}
        className={`mt-5 w-full font-bold py-3.5 rounded-xl text-base transition-all ${
          disabled
            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
            : "bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg hover:-translate-y-0.5"
        }`}
      >
        {submitting
          ? "Guardando…"
          : isExistingPet
            ? "Actualizar y continuar"
            : "Guardar y continuar"}
      </button>
      {hint && (
        <p className="mt-2 text-xs text-slate-400 text-center">{hint}</p>
      )}
    </>
  );
}
