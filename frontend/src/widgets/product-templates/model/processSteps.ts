import type { ProcessStep } from "@/widgets/ai-process";

// Pasos del "cómo funciona" de la ficha del rompecabezas. La landing define los
// suyos (`StudioLandingPage`) porque ahí el estilo se elige antes que el
// producto. Las promesas (material, plazos, cobertura) deben coincidir con
// /shipping-returns.
export const PRODUCT_PROCESS_STEPS: ProcessStep[] = [
  {
    img: "/process/2 approve.png",
    alt: "Eligiendo un estilo de arte para el retrato de una mascota",
    title: "1. Elige tu estilo",
    text: "Escoge el look que mejor va con tu mascota y toca Crear.",
  },
  {
    img: "/process/1. Upload Picture.png",
    alt: "Subiendo la foto de una mascota desde el celular",
    title: "2. Sube su foto",
    text: "Agrega fotos claras de tu mascota en JPG, PNG o WEBP.",
  },
  {
    img: "/process/3. Final Art.png",
    alt: "Retrato de una mascota hecho con IA en una pantalla",
    title: "3. Mira la vista previa gratis",
    text: "Si te encanta, lo imprimimos en MDF de 3 mm y te lo enviamos a todo Ecuador.",
  },
];
