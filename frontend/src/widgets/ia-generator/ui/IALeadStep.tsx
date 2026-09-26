"use client";

import { useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";

interface IALeadStepProps {
  onComplete: () => void;
  /** Sustituye el título de la pestaña "Create Account". */
  registerTitle?: string;
  /** Sustituye el subtítulo de la pestaña "Create Account". */
  registerSubtitle?: string;
}

export function IALeadStep({
  onComplete,
  registerTitle,
  registerSubtitle,
}: IALeadStepProps) {
  const { loginWithGoogle } = useAuth();

  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    setAuthError(null);

    if (!credentialResponse.credential) {
      setAuthError("Google no devolvió la sesión. Inténtalo de nuevo.");
      return;
    }

    try {
      await loginWithGoogle(credentialResponse.credential);
      onComplete();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión con Google.",
      );
    }
  };

  const handleGoogleError = () => {
    setAuthError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
  };

  return (
    <main className="grow flex items-center justify-center px-6 py-8 animate-in fade-in duration-500">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-[#E5E0D8] overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <h2 className="font-display text-2xl font-black text-slate-dark mb-1">
              {registerTitle ?? "Crea tu cuenta"}
            </h2>
            <p className="text-slate-dark/60 text-sm">
              {registerSubtitle ??
                "Guarda el perfil y las fotos de tu mascota de forma segura."}
            </p>
          </div>

          {/* Forms */}
          <div className="px-8 py-6 space-y-4">
            {authError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="material-symbols-outlined text-red-600 text-[18px]">
                  error
                </span>
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}

            {/* Google login */}
            <div className="flex w-full justify-center scheme:light">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
                logo_alignment="left"
                width="336"
              />
            </div>

            <p className="text-xs text-center text-slate-dark/40 italic">
              Al continuar, aceptas recibir novedades de ClawPuzzle.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
