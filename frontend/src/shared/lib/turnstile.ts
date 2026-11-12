/**
 * Token de Cloudflare Turnstile para `POST /auth/guest`. Carga el script una
 * sola vez y monta el widget en `container` con `appearance: interaction-only`:
 * casi siempre se resuelve sin que el visitante vea nada, y solo si Cloudflare
 * duda aparece la casilla dentro de `container`.
 */

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// Con la casilla visible el visitante necesita tiempo para pulsarla.
const TIMEOUT_MS = 60_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      language?: string;
      retry?: "auto" | "never";
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("turnstile_unavailable"));
    script.onerror = () => {
      // Permite reintentar en el siguiente envío (bloqueador, red caída).
      scriptPromise = null;
      reject(new Error("turnstile_load_failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function getTurnstileToken(
  container: HTMLElement,
  siteKey: string,
): Promise<string> {
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null;
    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      settle();
      // Se quita después de que Turnstile salga de su propio callback: quitarlo
      // dentro hace que su lógica de error intente reiniciar un widget que ya
      // no existe y lance un error no capturado.
      const id = widgetId;
      if (id) {
        setTimeout(() => {
          try {
            turnstile.remove(id);
          } catch {
            // Ya no estaba montado.
          }
        }, 0);
      }
    };
    const fail = () => finish(() => reject(new Error("turnstile_failed")));
    const timer = setTimeout(fail, TIMEOUT_MS);

    widgetId = turnstile.render(container, {
      sitekey: siteKey,
      appearance: "interaction-only",
      language: "es",
      // Un fallo (dominio no permitido, red) lo resuelve el llamador cayendo al
      // paso de cuenta: reintentar solo alarga la espera del visitante.
      retry: "never",
      callback: (token) => finish(() => resolve(token)),
      "error-callback": fail,
      "timeout-callback": fail,
    });
  });
}
