import type { GroceryItem, ParsedIngredient } from "./types";

const UNICODE: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const FRACTION_GLYPHS = Object.entries(UNICODE).sort(
  (a, b) => b[1] - a[1],
);

const UNIT_PATTERN =
  "cups?|tablespoons?|tbsps?|tbsp|teaspoons?|tsps?|tsp|pounds?|lbs?|lb|ounces?|oz|grams?|kilograms?|kg|milliliters?|ml|liters?|litres?|quarts?|pints?|gallons?|cloves?|cans?|packages?|pkgs?|slices?|pinch(?:es)?|dash(?:es)?|handfuls?|bunches?|heads?|sticks?|pieces?|sprigs?";

function parseLooseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const unicode = UNICODE[trimmed];
  if (unicode) return unicode;
  const mixedUnicode = trimmed.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixedUnicode) {
    return Number(mixedUnicode[1]) + UNICODE[mixedUnicode[2]];
  }
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = Number(trimmed);
  return Number.isFinite(decimal) ? decimal : null;
}

export function parseIngredient(line: string): ParsedIngredient {
  const raw = line.trim();
  const match = raw.match(
    new RegExp(
      `^((?:\\d+\\s+)?(?:\\d+\\s*\\/\\s*\\d+|[\\d.]+|[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+[¼½¾⅓⅔⅛⅜⅝⅞]))(?:\\s+(${UNIT_PATTERN}))?(?:\\s+|$)(.*)$`,
      "i",
    ),
  );
  if (!match) {
    return { amount: null, unit: null, name: raw.toLowerCase(), raw };
  }
  return {
    amount: parseLooseNumber(match[1]),
    unit: match[2] ? normalizeUnit(match[2]) : null,
    name: (match[3] || raw).replace(/^of\s+/i, "").trim().toLowerCase() || raw.toLowerCase(),
    raw,
  };
}

function normalizeUnit(unit: string): string {
  const value = unit.toLowerCase().replace(/\.$/, "");
  if (/^tbsp|^tablespoon/.test(value)) return "tbsp";
  if (/^tsp|^teaspoon/.test(value)) return "tsp";
  if (/^lb|^pound/.test(value)) return "lb";
  if (/^oz|^ounce/.test(value)) return "oz";
  if (/^cup/.test(value)) return "cup";
  if (value === "g" || /^gram/.test(value)) return "g";
  if (value === "kg" || /^kilogram/.test(value)) return "kg";
  if (value === "ml" || /^milliliter/.test(value)) return "ml";
  if (/^liter|^litre|^l$/.test(value)) return "l";
  return value.replace(/s$/, "");
}

export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "0";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const whole = Math.floor(abs + 1e-8);
  const fraction = abs - whole;
  let glyph = "";
  for (const [char, value] of FRACTION_GLYPHS) {
    if (Math.abs(fraction - value) < 0.02) {
      glyph = char;
      break;
    }
  }
  if (glyph) return `${sign}${whole ? String(whole) : ""}${glyph}`;
  if (fraction < 0.02) return `${sign}${whole}`;
  const rounded = Math.round(abs * 100) / 100;
  return `${sign}${String(rounded)}`;
}

export function scaleIngredientLine(line: string, factor: number): string {
  if (factor === 1) return line;
  const parsed = parseIngredient(line);
  if (parsed.amount == null) return line;
  const next = parsed.amount * factor;
  const rest = line.replace(
    /^((?:\d+\s+)?(?:\d+\s*\/\s*\d+|[\d.]+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛⅜⅝⅞]))/,
    formatAmount(next),
  );
  return rest === line
    ? `${formatAmount(next)}${parsed.unit ? ` ${parsed.unit}` : ""} ${parsed.name}`.trim()
    : rest;
}

export function parseServings(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function groceryKey(parsed: ParsedIngredient): string {
  return `${parsed.name}|${parsed.unit ?? ""}`;
}

export function formatGroceryLabel(item: {
  amount: number | null;
  unit: string | null;
  name: string;
  raw?: string;
}): string {
  if (item.amount == null) return item.raw || item.name;
  const unit = pluralizeUnit(item.amount, item.unit);
  return [formatAmount(item.amount), unit, item.name].filter(Boolean).join(" ");
}

function pluralizeUnit(amount: number, unit: string | null): string | null {
  if (!unit) return unit;
  if (Math.abs(amount - 1) < 0.02) return unit;
  if (unit === "cup") return "cups";
  if (["tbsp", "tsp", "oz", "lb", "g", "kg", "ml", "l"].includes(unit)) return unit;
  if (unit.endsWith("s")) return unit;
  return `${unit}s`;
}

export function mergeGroceryItem(
  existing: GroceryItem,
  incoming: ParsedIngredient,
  recipeId?: string,
  recipeTitle?: string,
): GroceryItem {
  const amount =
    existing.amount != null && incoming.amount != null
      ? existing.amount + incoming.amount
      : existing.amount ?? incoming.amount;
  const recipeIds = recipeId
    ? Array.from(new Set([...existing.recipeIds, recipeId]))
    : existing.recipeIds;
  const recipeTitles = recipeTitle
    ? Array.from(new Set([...existing.recipeTitles, recipeTitle]))
    : existing.recipeTitles;
  const next = {
    ...existing,
    amount,
    recipeIds,
    recipeTitles,
    checked: false,
  };
  return { ...next, label: formatGroceryLabel(next) };
}

export function matchesQuery(
  recipe: {
    title: string;
    sourceName: string | null;
    notes?: string;
    tags?: string[];
    ingredients: string[];
  },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    recipe.title,
    recipe.sourceName ?? "",
    recipe.notes ?? "",
    ...(recipe.tags ?? []),
    ...recipe.ingredients,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}
