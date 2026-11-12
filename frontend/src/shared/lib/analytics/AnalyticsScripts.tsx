/* eslint-disable @next/next/no-before-interactive-script-outside-document --
   Esa regla es del Pages Router. En App Router `beforeInteractive` es válido en
   todo lo que renderiza el root layout (comprobado: los stubs salen en el HTML
   del SSR y existen antes de hidratar). */
import Script from "next/script";
import { GA_MEASUREMENT_ID, META_PIXEL_ID } from "@/shared/config/analytics";

// Los stubs (`window.gtag` y `window.fbq` con su cola) van `beforeInteractive`:
// así existen antes de hidratar y el primer `trackPageView` de
// `PageViewTracker` no se pierde. Las librerías se cargan async después.
//
// - GA4: la vista de la carga completa la manda gtag solo con el `config`.
//   Esta propiedad ignora `send_page_view: false` (comprobado con una página
//   HTML mínima), así que no se usa: `PageViewTracker` manda a GA4 solo las
//   navegaciones del cliente, que gtag no detecta. Si la carga entra por
//   `/admin…` no se carga GA4 en absoluto: es la única forma de que esa vista
//   automática no mida el admin.
// - Meta: `disablePushState = true` evita que el píxel mande su propio PageView
//   en cada navegación del cliente; tampoco hay `track PageView` aquí.
//   `allowDuplicatePageViews = true` es imprescindible: sin él fbevents descarta
//   en silencio todo PageView después del primero de la carga, y las
//   navegaciones del cliente no llegarían a Meta (comprobado con el píxel real).
//
// Montar solo en `app/layout.tsx`.
export function AnalyticsScripts() {
  return (
    <>
      {GA_MEASUREMENT_ID && (
        <Script id="ga4-init" strategy="beforeInteractive">
          {`if(!location.pathname.startsWith('/admin')){
window.dataLayer=window.dataLayer||[];
window.gtag=function(){window.dataLayer.push(arguments);};
window.gtag('js',new Date());
window.gtag('config',${JSON.stringify(GA_MEASUREMENT_ID)});
var s=document.createElement('script');s.async=true;
s.src='https://www.googletagmanager.com/gtag/js?id='+${JSON.stringify(encodeURIComponent(GA_MEASUREMENT_ID))};
document.head.appendChild(s);}`}
        </Script>
      )}
      {META_PIXEL_ID && (
        <Script id="meta-pixel-init" strategy="beforeInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq.disablePushState=true;
fbq.allowDuplicatePageViews=true;
fbq('init',${JSON.stringify(META_PIXEL_ID)});`}
        </Script>
      )}
    </>
  );
}
