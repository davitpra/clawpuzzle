"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/shared/ui/Container";
import { useAuth } from "@/context/AuthContext";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import type {
  AccountUser,
  ApiEnvelope,
  UserProfile,
} from "@/entities/order/types";
import { WelcomeHeader } from "./WelcomeHeader";
import { DashboardTabs } from "./DashboardTabs";

// Texto fijo del header por ruta. Se hace match por prefijo (salvo "/user", que
// es exacto) para cubrir subrutas como /user/pets/[id].
function headerCopy(
  pathname: string,
  firstName: string,
): { title: string; subtitle: string } {
  if (pathname.startsWith("/user/orders"))
    return {
      title: "Tus pedidos",
      subtitle: "Sigue y revisa todo lo que has pedido.",
    };
  if (pathname.startsWith("/user/generations"))
    return {
      title: "Tu arte",
      subtitle: "Todas las vistas previas que has creado con tus mascotas.",
    };
  if (pathname.startsWith("/user/pets"))
    return {
      title: "Tus mascotas",
      subtitle: "Los compañeros detrás de tu arte.",
    };
  if (pathname.startsWith("/user/profile"))
    return {
      title: "Perfil y ajustes",
      subtitle: "Actualiza tu nombre y los datos de tu cuenta.",
    };
  // "/user" (Overview) y cualquier otra ruta caen aquí.
  return {
    title: `¡Hola de nuevo, ${firstName}!`,
    subtitle:
      "Gestiona tus pedidos, tu arte y tu cuenta en un solo lugar.",
  };
}

// Vive en el layout de /user, así WelcomeHeader y DashboardTabs persisten al
// navegar entre las pestañas (Overview, Orders, Pets, …) en vez de remontarse
// con cada página.
export function DashboardHeader() {
  const { user } = useAuth();
  const { get } = useAuthFetch();
  const pathname = usePathname();

  // /auth/me (AuthContext) no incluye fullName; /users/me sí. Sembramos con lo
  // que ya hay en el contexto y lo completamos con el perfil real.
  const [profile, setProfile] = useState<AccountUser>({
    fullName: user?.fullName,
    email: user?.email,
    role: user?.role,
    avatarUrl: user?.avatarUrl,
  });

  useEffect(() => {
    let active = true;

    get<ApiEnvelope<UserProfile>>("/users/me")
      .then((res) => {
        if (active && res.data) {
          setProfile({
            fullName: res.data.fullName,
            email: res.data.email,
            role: res.data.role,
            avatarUrl: res.data.avatarUrl,
          });
        }
      })
      .catch(() => {
        /* keep AuthContext fallback */
      });

    return () => {
      active = false;
    };
  }, [get]);

  const firstName = profile.fullName?.trim().split(/\s+/)[0] || "Buddy";
  const { title, subtitle } = headerCopy(pathname, firstName);

  return (
    <Container className="py-12">
      <WelcomeHeader user={profile} title={title} subtitle={subtitle} />
      <div className="mt-8">
        <DashboardTabs />
      </div>
    </Container>
  );
}
