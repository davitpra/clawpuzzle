"use client";

import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";

interface GoogleSignUpButtonProps {
  className?: string;
  tabIndex?: number;
  /** Se llama tras iniciar sesión (p. ej. para cerrar el menú mobile). */
  onDone?: () => void;
}

/**
 * CTA "Sign up" que abre directamente el popup de Google (flujo auth-code),
 * sin pasar por /login. El backend canjea el code y registra o inicia sesión.
 */
export default function GoogleSignUpButton({
  className,
  tabIndex,
  onDone,
}: GoogleSignUpButtonProps) {
  const { signIn, pending } = useGoogleSignIn({ onDone });

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={pending}
      tabIndex={tabIndex}
      className={`${className ?? ""} disabled:opacity-70 disabled:cursor-wait`}
    >
      Sign up
    </button>
  );
}
