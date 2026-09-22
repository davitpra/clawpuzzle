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
      setAuthError("No token received from Google. Please try again.");
      return;
    }

    try {
      await loginWithGoogle(credentialResponse.credential);
      onComplete();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Failed to sign in with Google.",
      );
    }
  };

  const handleGoogleError = () => {
    setAuthError("Failed to sign in with Google. Please try again.");
  };

  return (
    <main className="grow flex items-center justify-center px-6 py-8 animate-in fade-in duration-500">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-[#E5E0D8] overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <h2 className="font-display text-2xl font-black text-slate-dark mb-1">
              {registerTitle ?? "Create Your Account"}
            </h2>
            <p className="text-slate-dark/60 text-sm">
              {registerSubtitle ??
                "Save your pet\u2019s profile and photos securely."}
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
              By continuing, you agree to receive art updates from Claw and
              Soul.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
