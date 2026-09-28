"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface LandingThemeValue {
  /** La ficha tiene elegida la variante Perro. */
  isDogTheme: boolean;
  setDogTheme: (isDog: boolean) => void;
}

const LandingThemeContext = createContext<LandingThemeValue>({
  isDogTheme: false,
  setDogTheme: () => {},
});

/**
 * Comparte el tema elegido en la ficha de la landing con las cards de estilos,
 * que son una sección hermana. Con `isDogTheme` el valor lo fija quien lo usa
 * (paso de estilo de `/create`, que lo deriva de `variant_id`); sin provider
 * las cards muestran su imagen de siempre.
 */
export function LandingThemeProvider({
  isDogTheme: controlled,
  children,
}: {
  isDogTheme?: boolean;
  children: ReactNode;
}) {
  const [isDogTheme, setDogTheme] = useState(false);
  const value =
    controlled === undefined
      ? { isDogTheme, setDogTheme }
      : { isDogTheme: controlled, setDogTheme: () => {} };

  return (
    <LandingThemeContext.Provider value={value}>
      {children}
    </LandingThemeContext.Provider>
  );
}

export function useLandingTheme() {
  return useContext(LandingThemeContext);
}
