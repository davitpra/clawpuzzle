"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BRAND } from "@/shared/config/navigation";
import { WhatsAppIcon } from "@/shared/ui/SocialIcons";

/**
 * Botón flotante de contacto por WhatsApp. Solo para clientes con cuenta
 * (`isAuthenticated` ya excluye a los invitados) y nunca en el panel de admin.
 */
export function WhatsAppButton() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = usePathname();

  if (isLoading || !isAuthenticated) return null;
  if (pathname?.startsWith("/admin")) return null;

  const name = user?.fullName?.trim();
  const message = name
    ? `Hola, soy ${name}. Disculpa, tengo una consulta`
    : "Hola. Disculpa, tengo una consulta";
  const href = `https://wa.me/${BRAND.whatsappNumber}?text=${encodeURIComponent(message)}`;

  // Mientras la barra fija de "Crear mi rompecabezas" está visible,
  // `StickyPersonalizeBar` marca `body[data-sticky-bar]` y la variante
  // `in-data-sticky-bar:` sube el botón por encima de ella para no tapar su CTA.
  // En md+ hace falta repetirla: si no, `md:bottom-6` la pisa.
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[bottom,transform] duration-300 ease-out hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] md:right-6 md:bottom-6 in-data-sticky-bar:bottom-[calc(6rem+env(safe-area-inset-bottom))] md:in-data-sticky-bar:bottom-28"
    >
      <WhatsAppIcon className="size-8" />
    </a>
  );
}
