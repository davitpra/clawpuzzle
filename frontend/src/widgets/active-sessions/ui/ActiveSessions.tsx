"use client";

import { useAuthFetch } from "@/hooks/useAuthFetch";
import { useCallback, useEffect, useState } from "react";
import type { ApiEnvelope } from "@/entities/order/types";
import { parseUserAgent } from "../lib/parse-user-agent";

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  isCurrent?: boolean;
}

export function ActiveSessions() {
  const { get, post } = useAuthFetch();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await get<ApiEnvelope<{ sessions: Session[]; total: number }>>(
        "/auth/sessions"
      );
      setSessions(res.data?.sessions ?? []);
      setError("");
    } catch (err) {
      console.error("Error loading sessions:", err);
      setError("No se pudieron cargar las sesiones");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const revokeSession = async (sessionId: string) => {
    try {
      await post(`/auth/sessions/revoke/${sessionId}`);
      // Reload sessions
      await loadSessions();
    } catch (err) {
      console.error("Error revoking session:", err);
      setError("No se pudo cerrar la sesión");
    }
  };

  const revokeAllOtherSessions = async () => {
    if (
      !confirm(
        "¿Cerrar sesión en todos los demás dispositivos? Seguirás conectado en este."
      )
    ) {
      return;
    }

    try {
      const res = await post<ApiEnvelope<{ message: string; count: number }>>(
        "/auth/sessions/revoke-all"
      );
      alert(
        `Se cerró la sesión en ${res.data?.count ?? 0} dispositivo(s)`
      );
      await loadSessions();
    } catch (err) {
      console.error("Error revoking sessions:", err);
      setError("No se pudieron cerrar las sesiones");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-EC");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-text-muted">Cargando sesiones…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-black text-text-main">
            Sesiones activas
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Gestiona tus sesiones abiertas en todos tus dispositivos
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={revokeAllOtherSessions}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Cerrar sesión en los demás dispositivos
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No hay sesiones activas
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-cream/40 border border-[#dee2e3] rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary text-3xl">
                  {session.isCurrent ? "laptop" : "devices"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-black text-text-main">
                      {parseUserAgent(session.userAgent)}
                    </h3>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {session.ipAddress && <div>IP: {session.ipAddress}</div>}
                    <div>Logged in: {formatDate(session.createdAt)}</div>
                    {session.lastUsedAt && (
                      <div>Last active: {formatDate(session.lastUsedAt)}</div>
                    )}
                    <div>Expires: {formatDate(session.expiresAt)}</div>
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => revokeSession(session.id)}
                  className="px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            info
          </span>
          <div className="text-sm text-text-main">
            <p className="font-semibold mb-1">Consejo de seguridad</p>
            <p className="text-text-muted">
              Las sesiones se renuevan automáticamente por seguridad. Si ves
              dispositivos que no reconoces, ciérralos de inmediato y cambia tu
              contraseña.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
