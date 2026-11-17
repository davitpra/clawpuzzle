"use client";

import Image from "next/image";
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { useInView } from "@/hooks/useInView";
import type { ProcessStep } from "../model/types";

// Desktop: secuencia paso → flecha → paso en una fila. Todo entra en viewport a
// la vez, así que estos tiempos (base `--step-delay`) son los que hacen que el
// recorrido se lea de izquierda a derecha.
// Móvil: los pasos se turnan en el mismo lugar, en bucle (ver MobileStepCycle);
// ahí la base se ignora (ver `.step-seq` en globals.css) y solo cuentan los
// offsets internos de cada paso.
const STEP_INTERVAL = 0.8; // s entre el inicio de un paso y el del siguiente
const ARROW_LEAD = 0.45; // s tras el inicio de un paso en que arranca su flecha
const DOT_STAGGER = 0.07;
const DOTS = [0, 1, 2, 3, 4];

/** Tiempo que cada paso queda en pantalla en el carrusel móvil. */
const MOBILE_STEP_MS = 3500;

// Orden interno de un paso: círculo → ilustración → título → texto.
const OFFSET = { circle: 0, image: 0.15, title: 0.3, text: 0.4 } as const;

/** Variables de la secuencia; `base` solo cuenta en desktop. */
function seq(base: number, offset: number): CSSProperties {
  return {
    "--step-delay": `${base}s`,
    "--seq-offset": `${offset}s`,
  } as CSSProperties;
}

export function StepFlow({ steps }: { steps: ProcessStep[] }) {
  return (
    <>
      <div className="hidden lg:flex flex-row items-stretch gap-0">
        {steps.map((step, i) => (
          <Fragment key={step.title}>
            {i > 0 && (
              <DottedArrow delay={(i - 1) * STEP_INTERVAL + ARROW_LEAD} />
            )}
            <DesktopStep step={step} delay={i * STEP_INTERVAL} />
          </Fragment>
        ))}
      </div>
      <MobileStepCycle steps={steps} />
    </>
  );
}

function DesktopStep({ step, delay }: { step: ProcessStep; delay: number }) {
  // Cada paso observa su propio nodo: aparece cuando él entra en pantalla.
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex-1">
      <StepCard step={step} delay={delay} visible={inView} />
    </div>
  );
}

/**
 * Móvil: un solo paso a la vez, en el mismo lugar, rotando 1 → 2 → 3 → 1.
 * Los pasos se apilan en la misma celda del grid, así la altura es la del más
 * alto y el contenido de abajo no salta al cambiar. El bucle arranca cuando la
 * sección entra en pantalla; con "reducir movimiento" no avanza solo y se
 * navega con los indicadores.
 */
function MobileStepCycle({ steps }: { steps: ProcessStep[] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  // Depende de `active`: al tocar un indicador el temporizador se reinicia y
  // el paso elegido dura su intervalo completo.
  useEffect(() => {
    if (!inView || reducedMotion) return;
    const id = window.setTimeout(
      () => setActive((i) => (i + 1) % steps.length),
      MOBILE_STEP_MS
    );
    return () => window.clearTimeout(id);
  }, [active, inView, reducedMotion, steps.length]);

  return (
    <div ref={ref} className="lg:hidden flex flex-col items-center gap-8">
      <div className="grid w-full">
        {steps.map((step, i) => {
          const isActive = i === active;
          return (
            <div
              key={step.title}
              aria-hidden={!isActive}
              className={`col-start-1 row-start-1 transition-opacity duration-300 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Al volver a ser activo las clases de animación se reaplican y
                  la entrada se repite. */}
              <StepCard step={step} delay={0} visible={inView && isActive} />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <button
            key={step.title}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Ver paso ${i + 1}`}
            aria-current={i === active ? "step" : undefined}
            className="p-1"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-6 bg-primary" : "w-1.5 bg-slate-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function StepCard({
  step,
  delay,
  visible,
}: {
  step: ProcessStep;
  delay: number;
  visible: boolean;
}) {
  // Hasta que el paso es visible sus piezas quedan ocultas.
  const anim = (cls: string) => (visible ? `${cls} step-seq` : "opacity-0");

  return (
    <div className="group relative h-full">
      <div className="flex flex-col items-center gap-5 h-full">
        {/* rounded-full solo da un círculo si la caja es cuadrada: aspect-square
            evita que flex-1 la estire y la convierta en elipse. */}
        <div
          className={`w-full max-w-56 aspect-square flex items-center justify-center bg-white rounded-full ${anim("animate-step-pop")}`}
          style={seq(delay, OFFSET.circle)}
        >
          {/* `scale-105` usa la propiedad `scale`, no `transform`, así que el
              hover no choca con el keyframe de entrada. */}
          <Image
            src={step.img}
            alt={step.alt}
            width={200}
            height={150}
            className={`w-4/5 h-auto object-contain transition-all group-hover:scale-105 ${anim("animate-step-rise")}`}
            style={seq(delay, OFFSET.image)}
          />
        </div>
        <div className="text-center">
          <p
            className={`text-2xl font-black text-slate-dark tracking-tight ${anim("animate-step-rise")}`}
            style={seq(delay, OFFSET.title)}
          >
            {step.title}
          </p>
          <p
            className={`mt-2 text-sm text-slate-dark/50 leading-relaxed max-w-50 mx-auto ${anim("animate-step-rise")}`}
            style={seq(delay, OFFSET.text)}
          >
            {step.text}
          </p>
        </div>
      </div>
    </div>
  );
}

function DottedArrow({ delay }: { delay: number }) {
  // Los puntos se encienden uno tras otro hacia el paso siguiente.
  const { ref, inView } = useInView<HTMLDivElement>();
  const anim = inView ? "animate-step-dot step-seq" : "opacity-0";

  return (
    <div ref={ref} className="flex items-center justify-center px-2 shrink-0">
      <div className="flex items-center gap-0.5">
        {DOTS.map((i) => (
          <div
            key={i}
            className={`size-1 rounded-full bg-slate-300 ${anim}`}
            // Degradado de opacidad hacia la punta, para que el recorrido se lea
            // en dirección al paso siguiente. Es también el estado final de la
            // animación (el keyframe solo define `from`).
            style={{ ...seq(delay, i * DOT_STAGGER), opacity: 0.4 + i * 0.12 }}
          />
        ))}
        <div
          className={`ml-0.5 text-slate-400 ${anim}`}
          style={seq(delay, DOTS.length * DOT_STAGGER)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 5h8M5.5 1.5L9 5l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
