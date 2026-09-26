// Fuente única de la navegación del sitio y de los datos de contacto de la marca.
// Antes vivían duplicados en `Navbar.tsx`, `Footer.tsx` y `contact/page.tsx`, y ya
// habían divergido entre sí. Solo strings: los iconos sociales siguen siendo
// componentes que se importan en el TSX (`shared/ui/SocialIcons`).
//
// En modo lanzamiento (`LAUNCH_MODE`) este módulo resuelve el flag él mismo y
// exporta una navegación reducida, así que `Navbar` y `Footer` no necesitan
// saber nada del flag para pintar sus listas de links.

import { LAUNCH_MODE } from "./launch";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

/** Links principales del header, en el orden en que se muestran. */
const FULL_MAIN_NAV: NavLink[] = [
  { label: "Catálogo", href: "/catalog" },
  { label: "Contacto", href: "/contact" },
];

// Vacía a propósito: "Catalog" y "Contact" son rutas bloqueadas y "Create your
// art" se quitó (2026-09-19); el embudo entra por la landing y el footer. El
// contacto queda en el `mailto:` del pie del footer.
const LAUNCH_MAIN_NAV: NavLink[] = [];

export const MAIN_NAV: NavLink[] = LAUNCH_MODE
  ? LAUNCH_MAIN_NAV
  : FULL_MAIN_NAV;

/** Columnas de cuenta y soporte, comunes a las dos variantes del footer. */
const ACCOUNT_SECTION: NavSection = {
  // Los links de `/user/**` no se ocultan sin sesión: `app/user/layout.tsx`
  // redirige a `/login` por su cuenta.
  title: "Cuenta",
  links: [
    { label: "Mi cuenta", href: "/user" },
    { label: "Mi arte", href: "/user/generations" },
    { label: "Mis pedidos", href: "/user/orders" },
  ],
};

const SUPPORT_LINKS: NavLink[] = [
  { label: "Envíos y devoluciones", href: "/shipping-returns" },
  { label: "Política de privacidad", href: "/privacy" },
  { label: "Términos del servicio", href: "/terms" },
];

/**
 * Columnas del footer. Los links del catálogo llevan `intent`/`format` en la
 * query: son los mismos valores que leen `CATALOG_INTENTS` y `CATALOG_FORMATS`
 * (`widgets/catalog/model`), así que la página abre con esos chips ya marcados.
 */
const FULL_FOOTER_SECTIONS: NavSection[] = [
  {
    title: "Crear",
    links: [
      { label: "Rompecabezas de tu mascota", href: "/catalog" },
      { label: "Cómo funciona", href: "/studio-landing" },
      { label: "Comprar créditos", href: "/credits" },
    ],
  },
  {
    title: "Tienda",
    links: [
      { label: "Todos los rompecabezas", href: "/catalog" },
      { label: "Comprar créditos", href: "/credits" },
    ],
  },
  ACCOUNT_SECTION,
  {
    title: "Ayuda",
    links: [
      { label: "Contacto", href: "/contact" },
      { label: "Preguntas frecuentes", href: "/studio-landing#faq" },
      ...SUPPORT_LINKS,
    ],
  },
];

// Se cae la columna "Shop" entera (todo son links a `/catalog`) y los anclas
// apuntan a las secciones de la landing, que en lanzamiento vive en `/`.
const LAUNCH_FOOTER_SECTIONS: NavSection[] = [
  {
    title: "Crear",
    links: [
      { label: "Crear su rompecabezas", href: "/#styles" },
      { label: "Cómo funciona", href: "/#how-it-works" },
      { label: "Comprar créditos", href: "/credits" },
    ],
  },
  ACCOUNT_SECTION,
  {
    title: "Ayuda",
    links: [
      { label: "Preguntas frecuentes", href: "/#faq" },
      ...SUPPORT_LINKS,
    ],
  },
];

export const FOOTER_SECTIONS: NavSection[] = LAUNCH_MODE
  ? LAUNCH_FOOTER_SECTIONS
  : FULL_FOOTER_SECTIONS;

/**
 * Datos de contacto de la marca.
 * TODO: `facebookUrl` e `instagramUrl` son placeholders — reemplazar por los
 * perfiles reales antes de producción.
 */
export const BRAND = {
  name: "ClawPuzzle",
  email: "hello@clawpuzzle.com",
  facebookUrl: "#",
  instagramUrl: "#",
} as const;
