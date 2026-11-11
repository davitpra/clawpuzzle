import type { Metadata } from "next";
import { Epilogue, Lato } from "next/font/google";
import { preload } from "react-dom";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { SITE_URL } from "@/shared/config/seo";
import { AnalyticsScripts } from "@/shared/lib/analytics/AnalyticsScripts";
import { PageViewTracker } from "@/shared/lib/analytics/PageViewTracker";
import { Toaster } from "@/shared/ui/Toaster";

// Epilogue es variable: sin `weight` next/font emite un solo @font-face con
// `font-weight: 100 900`, así que pesa un archivo en vez de cuatro y los pesos
// intermedios (font-semibold) salen exactos en vez de aproximarse al vecino.
const epilogue = Epilogue({
  variable: "--font-epilogue",
  subsets: ["latin"],
});

// Lato es estática: cada peso es un .woff2 aparte que se precarga, así que solo
// pedimos los que se usan (font-light no aparece en el código).
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

/** Misma URL que el @font-face de globals.css: si no coinciden, el navegador
 *  se descarga el archivo dos veces. */
const MATERIAL_SYMBOLS_WOFF2 =
  "https://fonts.gstatic.com/s/materialsymbolsoutlined/v361/kJEPBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzBwG-RpA6RzaxHMPdY40KH8nGzv3fzfVJO1Q.woff2";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: "ClawPuzzle",
  description: "Rompecabezas personalizados con el arte de tu mascota, impresos en MDF de 3 mm y enviados a todo Ecuador.",
  // Verificación del dominio clawpuzzle.com en Meta Business. Next la emite en
  // el HTML del servidor (Meta no acepta la etiqueta si la inyecta JS).
  verification: {
    other: {
      "facebook-domain-verification": "jhnn81ctg8smqwvzeqby3mbbog0zzr",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sin este preload el navegador no descubre la fuente de iconos hasta
  // terminar de parsear el CSS, y los huecos de los iconos se quedan vacíos un
  // buen rato (con font-display: swap se veían las ligaduras en crudo:
  // "palette", "search", "shopping_cart"). Vía react-dom en vez de un <link>
  // en el JSX porque React hoistea ambos y acabábamos con la etiqueta repetida.
  preload(MATERIAL_SYMBOLS_WOFF2, {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });

  return (
    // Las clases `.variable` van en <html>, no en <body>: `--font-display` y
    // `--font-body` se declaran en :root (@theme de globals.css) y un var()
    // dentro de una custom property se resuelve en el elemento donde se
    // declara. Con las clases en <body>, --font-lato no existía en :root, la
    // variable quedaba inválida y toda la web caía al sans del sistema.
    <html
      lang="es"
      className={`light ${epilogue.variable} ${lato.variable}`}
    >
      <head>
        {/* El .woff2 de Material Symbols se sirve desde gstatic
            (@font-face en globals.css). Epilogue y Lato los self-hostea
            next/font, por eso ya no hace falta preconnect a googleapis. */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased bg-background-light dark:bg-background-dark text-text-main font-body">
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}
        >
          <AuthProvider>
            {/* Dentro de AuthProvider: la identificación del usuario para
                Meta/GA4 (TRACKING.md, paso 4) necesita useAuth. */}
            <PageViewTracker />
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
        <Toaster />
        <AnalyticsScripts />
      </body>
    </html>
  );
}
