import type { Logger } from "@opentelemetry/api-logs";
import type { LoggerProvider } from "@opentelemetry/sdk-logs";

let posthogLogger: Logger | undefined;
let loggerProvider: LoggerProvider | undefined;

function warnForMissingPostHogLogConfiguration(variable: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
    );
  }
}

async function initializePostHogLogs() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) {
    warnForMissingPostHogLogConfiguration(
      token ? "NEXT_PUBLIC_POSTHOG_HOST" : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
    );
    return;
  }

  const [
    { LoggerProvider, BatchLogRecordProcessor },
    { OTLPLogExporter },
    { resourceFromAttributes },
  ] = await Promise.all([
    import("@opentelemetry/sdk-logs"),
    import("@opentelemetry/exporter-logs-otlp-http"),
    import("@opentelemetry/resources"),
  ]);

  loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "clawpuzzle-web" }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host.replace(/\/$/, "")}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      }),
    ],
  });
  posthogLogger = loggerProvider.getLogger("posthog-clawpuzzle-logs");
}

export function getPostHogLogger() {
  return posthogLogger;
}

// En WSL2 (y algunos entornos) la conectividad IPv6 está rota: Shopify resuelve
// a una dirección IPv6 que hace black-hole, y el fetch de undici se cuelga hasta
// el timeout de 10s (UND_ERR_CONNECT_TIMEOUT). Forzar IPv4 primero evita el
// intento fallido. Import dinámico dentro del guard: el archivo también se
// compila para el bundle de Edge (por el proxy), donde node:dns no existe.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
    await initializePostHogLogs().catch((error) => {
      console.warn("PostHog log export initialization failed:", error);
    });
  }
}
