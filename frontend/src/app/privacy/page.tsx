// TODO (legal): este texto es una base genérica escrita a partir de lo que la
// app realmente hace (fotos de mascotas, generación con IA, pedidos vía
// Shopify). NO es asesoría legal: debe revisarlo un profesional antes de
// producción, sobre todo las secciones de retención de datos, terceros y
// derechos del usuario según la Ley Orgánica de Protección de Datos
// Personales de Ecuador.
import type { Metadata } from "next";
import { LegalPage } from "@/widgets/legal-page";
import { BRAND } from "@/shared/config/navigation";

export const metadata: Metadata = {
  title: "Política de privacidad · ClawPuzzle",
  description:
    "Cómo ClawPuzzle recopila, usa y protege tus datos, incluidas las fotos de tu mascota y el arte que generas.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      intro="Esta política explica qué datos recopilamos cuando usas ClawPuzzle, para qué los usamos y el control que tienes sobre ellos."
      lastUpdated="12 de noviembre de 2026"
    >
      <section>
        <h2>Datos que recopilamos</h2>
        <ul>
          <li>
            <strong>Datos de tu cuenta</strong>: tu nombre y correo
            electrónico, o el perfil básico que Google comparte con nosotros si
            inicias sesión con Google.
          </li>
          <li>
            <strong>Fotos y datos de tu mascota</strong>: las imágenes que
            subes al generador de arte, junto con el nombre y los datos de tu
            mascota que guardes con ellas. Para tu primera vista previa no
            necesitas cuenta: guardamos la foto y el arte en una sesión de
            invitado ligada a tu navegador.
          </li>
          <li>
            <strong>Arte generado</strong>: las vistas previas creadas a partir
            de tus fotos, guardadas para que puedas encontrarlas en tu cuenta.
          </li>
          <li>
            <strong>Datos de tus pedidos</strong>: lo que compraste, tu
            dirección de envío y el estado del pedido. Los pagos los procesa
            Shopify; nunca vemos ni guardamos los datos completos de tu tarjeta.
          </li>
          <li>
            <strong>Datos técnicos</strong>: información de sesión y datos
            básicos de uso necesarios para mantener tu sesión abierta y que el
            servicio funcione, además de los datos de medición que se explican
            en &quot;Cookies y medición&quot;. Para evitar abusos de la vista
            previa sin cuenta usamos Cloudflare Turnstile, que analiza señales
            técnicas del navegador para comprobar que eres una persona.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cómo los usamos</h2>
        <p>
          Usamos tus datos para crear el arte que nos pides, mantenerlo
          disponible en tu cuenta, fabricar y atender tus pedidos, y
          responderte cuando nos escribes. No vendemos tus datos personales ni
          usamos tus fotos para publicidad.
        </p>
      </section>

      <section>
        <h2>Proveedores de servicio</h2>
        <p>
          Algunas partes del servicio funcionan con terceros que actúan en
          nuestro nombre: Shopify para la tienda y el pago, Cloudinary para
          alojar las imágenes y los proveedores de IA que generan tu arte. Solo
          reciben lo que necesitan para cumplir su función. Cloudflare
          comprueba que la vista previa sin cuenta la pide una persona y no un
          programa automático.
        </p>
      </section>

      <section>
        <h2>Cookies y medición</h2>
        <p>
          Además de las cookies de sesión, usamos dos herramientas de medición
          que guardan sus propias cookies en tu navegador:
        </p>
        <ul>
          <li>
            <strong>Google Analytics</strong>: nos dice cuántas personas
            visitan la web, qué páginas ven y qué pasos completan (por ejemplo,
            generar una vista previa o iniciar una compra). Si tienes sesión
            iniciada, le enviamos tu identificador interno de cuenta, nunca tu
            nombre ni tu correo.
          </li>
          <li>
            <strong>Píxel de Meta</strong> (Facebook e Instagram): mide si
            nuestros anuncios llevan a visitas y compras, para saber cuáles
            funcionan. Si tienes sesión iniciada, compartimos con Meta tu
            identificador interno de cuenta y tu correo electrónico{" "}
            <strong>hasheado</strong> (convertido en un código irreversible
            antes de salir de tu navegador), que Meta usa solo para relacionar
            esos eventos con su propia cuenta de usuario.
          </li>
        </ul>
        <p>
          Nunca compartimos tus fotos, el arte de tu mascota ni tu dirección
          con estas herramientas. Puedes bloquear o borrar estas cookies desde
          la configuración de tu navegador sin que la tienda deje de funcionar,
          y gestionar los anuncios que ves desde la configuración de anuncios
          de tu cuenta de Meta.
        </p>
      </section>

      <section>
        <h2>Conservación de tus datos</h2>
        <p>
          Tus fotos, tu arte y tus pedidos permanecen en tu cuenta hasta que los
          borres o nos pidas cerrar tu cuenta. Si creaste una vista previa sin
          cuenta y no hiciste ningún pedido, borramos la foto y el arte a los 30
          días sin actividad; si antes inicias sesión con Google, pasan a tu
          cuenta. Los registros de pedidos pueden
          conservarse más tiempo cuando lo exigen normas contables o
          tributarias.
        </p>
      </section>

      <section>
        <h2>Tus opciones</h2>
        <p>
          Puedes ver y editar tus datos desde tu perfil, borrar mascotas y arte
          guardados cuando quieras y pedirnos que eliminemos tu cuenta por
          completo. Escribe a{" "}
          <a
            className="text-primary underline hover:text-primary-dark transition-colors"
            href={`mailto:${BRAND.email}`}
          >
            {BRAND.email}
          </a>{" "}
          y nos encargamos.
        </p>
      </section>

      <section>
        <h2>Seguridad</h2>
        <p>
          Las cookies de sesión son httpOnly, así que ningún script de tu
          navegador puede leerlas (tampoco las herramientas de medición
          descritas arriba), y los tokens de acceso duran poco. Ningún
          sistema es perfecto, pero tomamos medidas razonables para proteger tu
          cuenta.
        </p>
      </section>

      <section>
        <h2>Menores de edad</h2>
        <p>
          ClawPuzzle no está dirigido a menores de 13 años y no recopilamos
          sus datos personales de forma intencional.
        </p>
      </section>

      <section>
        <h2>Cambios en esta política</h2>
        <p>
          Si hacemos un cambio importante, actualizaremos la fecha al inicio de
          esta página. Seguir usando el servicio después de un cambio significa
          que aceptas la política actualizada.
        </p>
      </section>

      <section>
        <h2>Contacto</h2>
        <p>
          ¿Preguntas sobre esta política? Escribe a{" "}
          <a
            className="text-primary underline hover:text-primary-dark transition-colors"
            href={`mailto:${BRAND.email}`}
          >
            {BRAND.email}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
