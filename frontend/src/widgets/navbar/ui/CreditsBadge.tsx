"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCredits } from "@/hooks/useCredits";

/**
 * Pill con el saldo de créditos de generación, enlazado a /credits.
 * Se auto-gatea: no renderiza nada para admins ni mientras no haya saldo
 * (cargando / sin sesión / error), evitando parpadeos y espacio vacío.
 */
export default function CreditsBadge() {
  const { isAdmin } = useAuth();
  const { balance } = useCredits();

  if (isAdmin || balance === null) return null;

  const label = `${balance} ${balance === 1 ? "crédito" : "créditos"}`;

  return (
    <Link
      href="/credits"
      title={`Te quedan ${label}. Compra más`}
      aria-label={`Te quedan ${label}. Comprar más créditos.`}
      className="font-display inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 h-10 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
    >
      <span className="material-symbols-outlined text-base leading-none">
        auto_awesome
      </span>
      <span>{balance}</span>
      <span className="hidden sm:inline">
        {balance === 1 ? "crédito" : "créditos"}
      </span>
    </Link>
  );
}
