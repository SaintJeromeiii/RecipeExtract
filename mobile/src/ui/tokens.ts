export type Appearance = "cream" | "dark";

export type ThemeColors = {
  brand: string;
  brandDark: string;
  brandSoft: string;
  brandLine: string;
  gold: string;
  text: string;
  muted: string;
  surface: string;
  onBrand: string;
  border: string;
  paper: string;
  error: string;
  bg: string;
  chromeText: string;
  overlay: string;
};

export const creamColors: ThemeColors = {
  brand: "#2E7AE6",
  brandDark: "#1F5FBF",
  brandSoft: "rgba(46, 122, 230, 0.14)",
  brandLine: "rgba(46, 122, 230, 0.55)",
  gold: "#D4A84B",
  text: "#1A3044",
  muted: "#5E7180",
  surface: "#FFFFFF",
  onBrand: "#FFFFFF",
  border: "#E2E8EE",
  paper: "#F6F0E4",
  error: "#C4473A",
  bg: "#F6F0E4",
  chromeText: "#1A3044",
  overlay: "rgba(26, 48, 68, 0.4)",
};

export const darkColors: ThemeColors = {
  brand: "#2E7AE6",
  brandDark: "#85B8FF",
  brandSoft: "rgba(46, 122, 230, 0.22)",
  brandLine: "rgba(133, 184, 255, 0.5)",
  gold: "#D4A84B",
  text: "#F6F0E4",
  muted: "#9AA8B0",
  surface: "#172126",
  onBrand: "#FFFFFF",
  border: "rgba(246, 240, 228, 0.12)",
  paper: "#0E1519",
  error: "#E07A6E",
  bg: "#0E1519",
  chromeText: "#F6F0E4",
  overlay: "rgba(8, 12, 14, 0.7)",
};

/** Cream defaults for code that is not inside ThemeProvider. */
export const colors = creamColors;

export function colorsFor(appearance: Appearance): ThemeColors {
  return appearance === "dark" ? darkColors : creamColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
};

export const fonts = {
  heading: "Inter_700Bold",
  display: "Outfit_700Bold",
  body: "Inter_400Regular",
};

/** Title, subtitle, body, caption — keep screens on this scale. */
export const type = {
  display: 28,
  title: 22,
  body: 16,
  caption: 13,
};
