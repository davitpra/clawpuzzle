// TODO (legal): base genérica, no asesoría legal. Debe revisarlo un profesional
// antes de producción — en particular la licencia sobre las fotos subidas, la
// propiedad del arte generado, las limitaciones de responsabilidad y lo que
// exija la normativa ecuatoriana de defensa del consumidor.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/widgets/legal-page";
import { BRAND } from "@/shared/config/navigation";

export const metadata: Metadata = {
  title: "Términos del servicio · ClawPuzzle",
  description:
    "Los términos que rigen el uso de ClawPuzzle: cuentas, créditos, fotos que subes, arte generado y pedidos.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos del servicio"
      intro="Estos términos cubren tu uso de ClawPuzzle: el generador de arte con IA, los créditos y los rompecabezas que nos pidas."
      lastUpdated="15 de noviembre de 2026"
    >
      <section>
        <h2>Tu cuenta</h2>
        <p>
          Necesitas una cuenta para guardar mascotas, arte y pedidos. Eres
          responsable de lo que ocurra con tu cuenta. Avísanos de inmediato si
          crees que otra persona tiene acceso a ella.
        </p>
      </section>

      <section>
        <h2>Fotos que subes</h2>
        <p>
          Debes ser dueño de las fotos que subes o tener permiso para usarlas.
          No subas nada ilegal, ofensivo o que infrinja los derechos de otras
          personas. Tus fotos siguen siendo tuyas; nos das permiso para
          procesarlas y así crear tu arte y fabricar tu pedido.
        </p>
      </section>

      <section>
        <h2>Arte que generamos</h2>
        <p>
          Los retratos creados a partir de tu foto son tuyos para guardarlos e
          imprimirlos para uso personal. Revenderlos o distribuirlos
          comercialmente requiere nuestro permiso por escrito.
        </p>
        <p>
          La generación con IA no es exacta. Los resultados varían según el
          estilo y la foto, y una vista previa que se completa se considera
          entregada aunque hubieras preferido otro resultado.
        </p>
      </section>

      <section>
        <h2>Créditos</h2>
        <p>
          Cada vista previa con IA usa un crédito. Los créditos se consumen al
          generar, no tienen valor en efectivo y no se pueden transferir entre
          cuentas. Si una generación falla por un problema de nuestra parte,
          escríbenos y te devolvemos los créditos.
        </p>
      </section>

      <section>
        <h2>Pedidos y pagos</h2>
        <p>
          El pedido se procesa a través de Shopify, y los precios e impuestos
          se muestran antes de confirmarlo. Los rompecabezas se pagan en dos
          partes: un anticipo del 70% por transferencia para iniciar la
          producción y el 30% restante en efectivo al momento de la entrega.
          Consulta{" "}
          <Link
            className="text-primary underline hover:text-primary-dark transition-colors"
            href="/shipping-returns"
          >
            Envíos y devoluciones
          </Link>{" "}
          para ver los pagos, los tiempos de entrega y la política de
          devoluciones de productos personalizados.
        </p>
      </section>

      <section>
        <h2>Uso aceptable</h2>
        <p>
          No intentes romper, sobrecargar o hacer ingeniería inversa del
          servicio, extraer datos de forma automática, ni usarlo para crear
          contenido que dañe a otras personas. Podemos suspender las cuentas que
          lo hagan.
        </p>
      </section>

      <section>
        <h2>Disponibilidad</h2>
        <p>
          Trabajamos para que ClawPuzzle funcione siempre, pero no podemos
          garantizar que esté disponible o libre de errores en todo momento.
          Las funciones pueden cambiar o retirarse a medida que el producto
          evoluciona.
        </p>
      </section>

      <section>
        <h2>Responsabilidad</h2>
        <p>
          En la medida que lo permita la ley, nuestra responsabilidad por
          cualquier reclamo relacionado con el servicio se limita al monto que
          nos pagaste por el pedido o los créditos a los que se refiere el
          reclamo.
        </p>
      </section>

      <section>
        <h2>Cambios</h2>
        <p>
          Podemos actualizar estos términos. La fecha al inicio de esta página
          indica la versión vigente, y seguir usando el servicio significa que
          la aceptas.
        </p>
      </section>

      <section>
        <h2>Contacto</h2>
        <p>
          ¿Preguntas sobre estos términos? Escribe a{" "}
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
