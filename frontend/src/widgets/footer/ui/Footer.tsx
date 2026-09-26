import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { FacebookIcon, InstagramIcon } from "@/shared/ui/SocialIcons";
import WavesDivider from "@/shared/ui/WavesDivider";
import { BRAND, FOOTER_SECTIONS } from "@/shared/config/navigation";
import { LAUNCH_MODE } from "@/shared/config/launch";

// Tailwind necesita ver la clase completa, así que el número de columnas se
// elige de un mapa literal y nunca se interpola.
const SECTION_COLS: Record<number, string> = {
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export default function Footer() {
  return (
    <>
      <WavesDivider
        fillColor="var(--color-slate-dark)"
        waveWidth={0.1}
        height={20}
      />
      <footer className="bg-slate-dark text-white py-16">
        <Container>
          {/* Cierre del funnel principal. Con la tienda completa el gancho es
              el Studio (gratis, sin cuenta); en lanzamiento el embudo es el
              arte con IA, y el Studio queda como link discreto en la columna
              "Create" (ver `shared/config/navigation.ts`). */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <h3 className="font-display text-2xl md:text-3xl font-black mb-3">
                Una pieza de tu mejor amigo para tenerla contigo
              </h3>
              <p className="text-white/70">
                {LAUNCH_MODE
                  ? "Elige un estilo, sube su foto y mira la vista previa gratis. Si te encanta, te lo enviamos como rompecabezas a todo Ecuador."
                  : "Elige un rompecabezas, sube la foto de tu mascota y mira la vista previa gratis antes de pedirlo."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <Link
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                href={LAUNCH_MODE ? "/#styles" : "/catalog"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  extension
                </span>
                {LAUNCH_MODE ? "Crear su rompecabezas" : "Ver rompecabezas"}
              </Link>
              {/* Enlace a /catalog: ruta bloqueada en modo lanzamiento. */}
              {!LAUNCH_MODE && (
                <Link
                  className="text-white/70 hover:text-white font-bold transition-all"
                  href="/catalog"
                >
                  Crear mi rompecabezas
                </Link>
              )}
            </div>
          </div>

          <div
            className={`border-t border-white/10 mt-12 pt-12 grid grid-cols-2 gap-8 ${
              SECTION_COLS[FOOTER_SECTIONS.length] ?? "md:grid-cols-4"
            }`}
          >
            {FOOTER_SECTIONS.map((section) => (
              <nav
                key={section.title}
                aria-label={section.title}
                className="flex flex-col gap-4"
              >
                <h4 className="font-display font-black text-lg">
                  {section.title}
                </h4>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    className="text-white/70 hover:text-white transition-all"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col-reverse items-center gap-6 sm:flex-row sm:justify-between">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a
                className="text-white/70 hover:text-primary transition-all flex items-center gap-2 text-sm"
                href={`mailto:${BRAND.email}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  mail
                </span>
                {BRAND.email}
              </a>
              <div className="flex gap-3">
                <a
                  aria-label="Facebook"
                  className="bg-white/10 p-2 rounded-full hover:bg-primary transition-all"
                  href={BRAND.facebookUrl}
                >
                  <FacebookIcon className="size-5" />
                </a>
                <a
                  aria-label="Instagram"
                  className="bg-white/10 p-2 rounded-full hover:bg-primary transition-all"
                  href={BRAND.instagramUrl}
                >
                  <InstagramIcon className="size-5" />
                </a>
              </div>
            </div>
          </div>
        </Container>
      </footer>
    </>
  );
}
