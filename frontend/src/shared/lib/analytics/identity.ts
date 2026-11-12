// Decide qué hacer con la identidad de Meta/GA4 cuando cambia la sesión.
// Lógica pura (sin React) para poder probarla en vitest/node; la aplica
// `AnalyticsIdentity`.

export interface IdentityUser {
  id: string;
  email: string;
  role?: string;
}

export type IdentityAction =
  | { type: "identify"; id: string; email: string }
  | { type: "clear" }
  | { type: "none" };

/**
 * @param identifiedId id que ya se mandó a Meta/GA4 (o `null`).
 * @param user usuario actual de `useAuth()`.
 * @param isLoading `true` mientras `checkAuth` no ha terminado: no se toca
 *   nada, así no se borra la identidad antes de saber si hay sesión.
 */
export function nextIdentityAction(
  identifiedId: string | null,
  user: IdentityUser | null,
  isLoading: boolean,
): IdentityAction {
  if (isLoading) return { type: "none" };

  // El admin no se mide: se trata como si no hubiera sesión.
  const tracked = user && user.role !== "admin" ? user : null;

  if (tracked) {
    if (tracked.id === identifiedId) return { type: "none" };
    return { type: "identify", id: tracked.id, email: tracked.email };
  }
  return identifiedId ? { type: "clear" } : { type: "none" };
}
