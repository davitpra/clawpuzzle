// Decide qué hacer con la identidad de Meta/GA4 cuando cambia la sesión.
// Lógica pura (sin React) para poder probarla en vitest/node; la aplica
// `AnalyticsIdentity`.

export interface IdentityUser {
  id: string;
  email: string;
  role?: string;
}

export type IdentityAction =
  | { type: "identify"; id: string; email: string | null; key: string }
  | { type: "clear" }
  | { type: "none" };

/**
 * Email que se manda a Meta. El invitado (imagen gratis sin login) solo se
 * identifica por id: su email es sintético y no coincide con nada.
 */
function matchEmail(user: IdentityUser): string | null {
  return user.role === "guest" ? null : user.email;
}

/**
 * Lo que ya se mandó para este usuario. Incluye el email porque un invitado
 * que se registra conserva el id y gana un email: hay que volver a identificarlo
 * para que el `Purchase` de Shopify coincida.
 */
export function identityKey(user: IdentityUser): string {
  return `${user.id}|${matchEmail(user) ?? ""}`;
}

/**
 * @param identifiedKey `identityKey` de lo que ya se mandó a Meta/GA4 (o `null`).
 * @param user usuario actual de `useAuth()`.
 * @param isLoading `true` mientras `checkAuth` no ha terminado: no se toca
 *   nada, así no se borra la identidad antes de saber si hay sesión.
 */
export function nextIdentityAction(
  identifiedKey: string | null,
  user: IdentityUser | null,
  isLoading: boolean,
): IdentityAction {
  if (isLoading) return { type: "none" };

  // El admin no se mide: se trata como si no hubiera sesión.
  const tracked = user && user.role !== "admin" ? user : null;

  if (tracked) {
    const key = identityKey(tracked);
    if (key === identifiedKey) return { type: "none" };
    return {
      type: "identify",
      id: tracked.id,
      email: matchEmail(tracked),
      key,
    };
  }
  return identifiedKey ? { type: "clear" } : { type: "none" };
}
