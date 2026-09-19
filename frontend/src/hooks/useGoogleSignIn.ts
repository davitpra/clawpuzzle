"use client";

import { useCallback, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

import { useAuth } from "@/context/AuthContext";

/**
 * Abre el popup de Google (flujo auth-code) y registra o inicia sesión sin salir
 * de la página. Lo usan el "Sign up" del navbar y las acciones que exigen sesión
 * (guardar en el estudio, comprar créditos), que en lanzamiento no tienen /login.
 *
 * `signIn` debe llamarse directamente desde un click: si no, el navegador
 * bloquea el popup.
 */
export function useGoogleSignIn({ onDone }: { onDone?: () => void } = {}) {
  const { loginWithGoogleCode } = useAuth();
  const [pending, setPending] = useState(false);

  const openPopup = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async ({ code }) => {
      try {
        await loginWithGoogleCode(code);
        onDone?.();
      } catch (error) {
        console.error("Google sign-in failed:", error);
      } finally {
        setPending(false);
      }
    },
    onError: (error) => {
      console.error("Google sign-in failed:", error);
      setPending(false);
    },
    // Popup cerrado o bloqueado: solo se libera el estado.
    onNonOAuthError: () => setPending(false),
  });

  const signIn = useCallback(() => {
    setPending(true);
    openPopup();
  }, [openPopup]);

  return { signIn, pending };
}
