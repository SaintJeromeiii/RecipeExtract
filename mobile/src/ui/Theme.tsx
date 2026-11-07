import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { colorsFor, type Appearance, type ThemeColors } from "./tokens";

const THEME_KEY = "recipeextract.appearance.v1";

type ThemeValue = {
  appearance: Appearance;
  colors: ThemeColors;
  setAppearance: (next: Appearance) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>("cream");

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((raw) => {
      if (raw === "dark" || raw === "cream") setAppearanceState(raw);
    });
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      appearance,
      colors: colorsFor(appearance),
      setAppearance,
    }),
    [appearance, setAppearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    return {
      appearance: "cream",
      colors: colorsFor("cream"),
      setAppearance: () => {},
    };
  }
  return value;
}
