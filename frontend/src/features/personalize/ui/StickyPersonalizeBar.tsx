"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";

interface StickyPersonalizeBarProps {
  /** El botón real de la ficha: la barra aparece cuando queda atrás. */
  anchor: HTMLElement | null;
  product: ShopifyProduct;
  selectedVariant: ShopifyVariant | undefined;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

// La navbar sticky mide 64px: el botón "se pierde" al quedar debajo de ella.
const NAVBAR_OFFSET_PX = 96;

const noopSubscribe = () => () => {};

/**
 * Barra fija abajo con el producto y el CTA de personalizar. Se muestra cuando
 * el visitante ya pasó el botón de la ficha y se oculta al volver a verlo o al
 * llegar al footer, para no tapar sus links.
 */
export default function StickyPersonalizeBar({
  anchor,
  product,
  selectedVariant,
  label,
  disabled,
  onClick,
}: StickyPersonalizeBarProps) {
  const [passedAnchor, setPassedAnchor] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  // Scroll + resize en vez de IntersectionObserver: un salto directo (link a
  // `#faq`, volver arriba) lleva el botón de "arriba" a "abajo" sin cruzar el
  // viewport y el observer no se enteraría.
  useEffect(() => {
    if (!anchor) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setPassedAnchor(
        anchor.getBoundingClientRect().bottom <= NAVBAR_OFFSET_PX,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [anchor]);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => {
      setFooterVisible(entry.isIntersecting);
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // Portal a <body>: dentro de la sección quedaría atrapada en su contexto de
  // apilamiento y las secciones siguientes la taparían.
  // `document` solo existe en el cliente; en SSR e hidratación no se renderiza.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const visible = passedAnchor && !footerVisible;

  const image = selectedVariant?.image ?? product.images.edges[0]?.node;
  const price = selectedVariant?.price;

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-text-main/10 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-300 items-center gap-3 px-4 py-3 md:gap-4 md:px-10">
        {image && (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src={image.url}
              alt={image.altText || product.title}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-sm font-bold text-text-main md:text-lg">
            {product.title}
          </span>
          {price && (
            <span className="font-display text-base font-black text-primary md:text-xl">
              {/* Mismo formato que el precio de la ficha (`ProductInfo`). */}
              ${parseFloat(price.amount).toFixed(2)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white transition-all hover:bg-primary-dark hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none md:h-12 md:px-6 md:text-base"
        >
          <span className="material-symbols-outlined hidden md:inline">
            auto_fix_high
          </span>
          {label}
        </button>
      </div>
    </div>,
    document.body,
  );
}
