// TODO (contenido): la ventana para reportar daños sigue sin cifra; rellenarlos con los datos reales de la operación antes de
// producción. No inventar números aquí: esta página es una promesa al cliente.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/widgets/legal-page";
import { BRAND } from "@/shared/config/navigation";
import { LAUNCH_MODE } from "@/shared/config/launch";

export const metadata: Metadata = {
  title: "Envíos y devoluciones · ClawPuzzle",
  description:
    "Cómo se fabrican, empacan y entregan los rompecabezas de ClawPuzzle en Ecuador, y qué hacer si algo llega mal.",
};

export default function ShippingReturnsPage() {
  return (
    <LegalPage
      title="Envíos y devoluciones"
      intro="Cada rompecabezas se fabrica bajo pedido con la foto de tu mascota. Esto es lo que puedes esperar desde que pagas hasta que llega a tu puerta."
      lastUpdated="15 de noviembre de 2026"
    >
      <section>
        <h2>Hecho bajo pedido</h2>
        <p>
          Tu rompecabezas se imprime sobre MDF de 3 mm después de que haces el
          pedido: preparamos tu arte, lo imprimimos, lo cortamos y lo revisamos
          antes de enviarlo. La producción toma 3 días.
        </p>
      </section>

      <section>
        <h2>Pagos</h2>
        <p>
          Pagas tu pedido en dos partes. Al recibirlo pagas en efectivo cerca
          del 30% del total, redondeado hacia abajo a un múltiplo de $10 para
          que pagues solo con billetes; el resto lo transfieres para empezar,
          y con ese anticipo confirmado iniciamos la producción. Por ejemplo,
          en un rompecabezas de $69,99 transfieres $49,99 y pagas $20 al
          recibirlo; en 2 rompecabezas ($119,98) transfieres $89,98 y pagas
          $30. Al terminar tu compra verás las instrucciones para hacer la
          transferencia.
        </p>
      </section>

      <section>
        <h2>Envíos</h2>
        <p>
          Enviamos a todo Ecuador. Una vez producido, el envío toma de 3 a 7
          días, según tu ciudad. El envío es gratis a todo Ecuador.
        </p>
      </section>

      <section>
        <h2>Seguimiento de tu pedido</h2>
        <p>
          Puedes seguir el estado de cada pedido desde{" "}
          <Link
            className="text-primary underline hover:text-primary-dark transition-colors"
            href="/user/orders"
          >
            tus pedidos
          </Link>
          . Te avisamos por correo cuando sale de nuestro taller.
        </p>
      </section>

      <section>
        <h2>Productos dañados o incorrectos</h2>
        <p>
          Si tu pedido llega dañado, o lo que recibiste no coincide con lo que
          pediste, escríbenos con una foto del rompecabezas y del empaque y te
          lo reponemos sin costo.
        </p>
      </section>

      <section>
        <h2>Devoluciones de productos personalizados</h2>
        <p>
          Como cada rompecabezas se hace con tu propia foto, no se puede volver
          a vender, así que no aceptamos devoluciones por cambio de opinión. Por
          eso la vista previa es gratis: mira el resultado antes de pedirlo y,
          si algo no te convence, escríbenos y te ayudamos.
        </p>
      </section>

      <section>
        <h2>Cancelar un pedido</h2>
        <p>
          Podemos cancelar un pedido mientras no haya empezado la producción.
          Escríbenos lo antes posible y lo revisamos.
        </p>
      </section>

      <section>
        <h2>Contacto</h2>
        <p>
          Cualquier consulta sobre una entrega o una devolución: escribe a{" "}
          <a
            className="text-primary underline hover:text-primary-dark transition-colors"
            href={`mailto:${BRAND.email}`}
          >
            {BRAND.email}
          </a>
          {/* En lanzamiento `/contact` está bloqueada. */}
          {!LAUNCH_MODE && (
            <>
              {" "}
              o usa el{" "}
              <Link
                className="text-primary underline hover:text-primary-dark transition-colors"
                href="/contact"
              >
                formulario de contacto
              </Link>
            </>
          )}
          .
        </p>
      </section>
    </LegalPage>
  );
}
