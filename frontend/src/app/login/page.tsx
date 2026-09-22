"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string>("");

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    setError("");

    if (!credentialResponse.credential) {
      setError("No token received from Google. Please try again.");
      return;
    }

    try {
      await loginWithGoogle(credentialResponse.credential);

      const redirectTo = searchParams.get("redirect") || "/";
      router.push(redirectTo);
    } catch (err) {
      console.error("Google login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sign in with Google.";
      setError(errorMessage);
    }
  };

  const handleGoogleError = () => {
    setError("Failed to sign in with Google. Please try again.");
  };

  return (
    <div className="flex min-h-screen w-full bg-background-light">
      {/* Left panel: heartwarming image */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
          style={{
            backgroundImage: `url("/images/login-hero.webp")`,
          }}
          role="img"
          aria-label="Painterly portrait of a dog and cat cuddling together"
        />
        {/* Brand tint + gradient for legibility */}
        <div className="absolute inset-0 bg-primary/15 mix-blend-multiply" />
        <div className="absolute inset-0 bg-linear-to-t from-slate-dark/80 via-slate-dark/20 to-transparent" />

        {/* Logo */}
        <Link
          href="/"
          className="absolute left-10 top-10 z-10 flex items-center gap-2 text-white"
        >
          <h2 className="font-display text-white text-lg lg:text-2xl font-black leading-tight tracking-[-0.015em] hidden sm:block">
            ClawPuzzle
          </h2>
        </Link>

        {/* Welcome message */}
        <div className="absolute inset-x-10 bottom-12 z-10 text-white">
          <h2 className="max-w-md font-display text-4xl font-black leading-tight drop-shadow-md">
            Your pet&apos;s soul, turned into art
          </h2>
          <p className="mt-3 max-w-md text-lg text-white/90 drop-shadow-sm">
            Sign in to keep creating personalized memories that last a lifetime.
          </p>

          {/* Floating trust card */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
            <span className="text-base tracking-tight text-yellow-500">
              ★★★★★
            </span>
            <p className="text-sm font-bold text-slate-dark">
              Loved by thousands of families
            </p>
          </div>
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-8">
        <div className="flex w-full max-w-105 flex-col gap-8">
          {/* Logo on mobile */}
          <Link
            href="/"
            className="flex items-center gap-2 text-text-main lg:hidden"
          >
            <h2 className="font-display text-text-main text-lg lg:text-2xl font-black leading-tight tracking-[-0.015em] hidden sm:block">
              ClawPuzzle
            </h2>
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl">
              Welcome
            </h1>
            <p className="text-base text-text-muted">
              Sign in or create your account with Google to continue.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4">
              <span className="material-symbols-outlined text-xl text-red-600">
                error
              </span>
              <p className="text-sm font-medium text-red-600">{error}</p>
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
              width="400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background-light" />
      }
    >
      <LoginContent />
    </Suspense>
  );
}
