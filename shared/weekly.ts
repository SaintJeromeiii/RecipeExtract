import type { Weekday, WeeklyMeal } from "./types";

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const LONG: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
}

export function weekdayLabel(day: Weekday): string {
  return SHORT[day];
}

export function weekdayLong(day: Weekday): string {
  return LONG[day];
}

export function parseShopLines(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(","))
    .map((line) => line.trim())
    .filter(Boolean);
}

export function hydrateWeeklyMeal(value: unknown): WeeklyMeal | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<WeeklyMeal>;
  if (typeof input.id !== "string" || typeof input.title !== "string") return null;
  const title = input.title.trim();
  if (!title) return null;
  return {
    id: input.id,
    title,
    recipeId: typeof input.recipeId === "string" && input.recipeId ? input.recipeId : null,
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [],
    weekday: isWeekday(input.weekday) ? input.weekday : null,
    checked: Boolean(input.checked),
    addedAt: typeof input.addedAt === "string" ? input.addedAt : new Date().toISOString(),
  };
}

export function sortWeeklyMeals(meals: WeeklyMeal[]): WeeklyMeal[] {
  return [...meals].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export function groupWeeklyMeals(meals: WeeklyMeal[]): Array<{
  key: string;
  label: string;
  meals: WeeklyMeal[];
}> {
  const groups = new Map<string, { key: string; label: string; meals: WeeklyMeal[] }>();
  for (const meal of sortWeeklyMeals(meals)) {
    const key = meal.weekday ?? "any";
    const label = meal.weekday ? weekdayLong(meal.weekday) : "Anytime this week";
    const existing = groups.get(key);
    if (existing) existing.meals.push(meal);
    else groups.set(key, { key, label, meals: [meal] });
  }
  return [...groups.values()];
}
