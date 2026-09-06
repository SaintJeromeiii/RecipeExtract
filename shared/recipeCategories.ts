import type { Recipe, RecipeCategory, SavedRecipe } from "./types";

export const RECIPE_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "drinks",
  "snacks",
  "dessert",
  "sides",
  "other",
] as const;

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  drinks: "Drinks",
  snacks: "Snacks",
  dessert: "Dessert",
  sides: "Sides",
  other: "Other",
};

const CATEGORY_HINTS: Array<[RecipeCategory, string[]]> = [
  [
    "drinks",
    [
      "cocktail",
      "mocktail",
      "smoothie",
      "milkshake",
      "lemonade",
      "iced tea",
      "hot chocolate",
      "coffee",
      "latte",
      "margarita",
      "mojito",
      "sangria",
      "punch",
      "juice",
    ],
  ],
  [
    "breakfast",
    [
      "breakfast",
      "brunch",
      "pancake",
      "waffle",
      "french toast",
      "omelet",
      "omelette",
      "scrambled egg",
      "breakfast burrito",
      "granola",
      "oatmeal",
      "muffin",
      "bagel",
      "banana bread",
    ],
  ],
  [
    "dessert",
    [
      "dessert",
      "cake",
      "cookie",
      "brownie",
      "pie",
      "tart",
      "ice cream",
      "cupcake",
      "cheesecake",
      "pudding",
      "chocolate",
    ],
  ],
  [
    "snacks",
    ["snack", "appetizer", "dip", "nachos", "popcorn", "trail mix", "chips"],
  ],
  [
    "sides",
    ["side dish", "side salad", "coleslaw", "cornbread", "mashed potato", "rice pilaf"],
  ],
  [
    "lunch",
    ["lunch", "sandwich", "wrap", "salad", "soup", "quesadilla"],
  ],
  [
    "dinner",
    [
      "dinner",
      "pasta",
      "lasagna",
      "stir fry",
      "stir-fry",
      "roast",
      "stew",
      "curry",
      "taco",
      "burrito",
      "casserole",
      "chicken",
      "steak",
      "salmon",
      "paella",
      "mac and cheese",
      "macaroni",
    ],
  ],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHint(haystack: string, hint: string): boolean {
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(hint)}s?(?:\\s|$)`, "i");
  return pattern.test(haystack.replace(/-/g, " "));
}

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return (
    typeof value === "string" &&
    (RECIPE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function recipeCategoryLabel(category: RecipeCategory): string {
  return RECIPE_CATEGORY_LABELS[category];
}

export function normalizeRecipeCategories(value: unknown): RecipeCategory[] {
  if (!Array.isArray(value)) return [];
  const next: RecipeCategory[] = [];
  for (const item of value) {
    if (isRecipeCategory(item) && !next.includes(item)) next.push(item);
  }
  return next;
}

export function guessRecipeCategories(recipe: Pick<Recipe, "title" | "description">): RecipeCategory[] {
  const hay = `${recipe.title} ${recipe.description ?? ""}`.toLowerCase();
  const found: RecipeCategory[] = [];
  for (const [category, hints] of CATEGORY_HINTS) {
    if (hints.some((hint) => hasHint(hay, hint)) && !found.includes(category)) {
      found.push(category);
    }
  }
  return found.slice(0, 2);
}

export function hydrateRecipeCategories(
  input: Partial<SavedRecipe>,
  recipe: Pick<Recipe, "title" | "description">,
): RecipeCategory[] {
  const explicit = normalizeRecipeCategories(input.categories);
  if (explicit.length) return explicit;
  const fromTags = normalizeRecipeCategories(
    Array.isArray(input.tags)
      ? input.tags.map((tag) => String(tag).trim().toLowerCase())
      : [],
  );
  if (fromTags.length) return fromTags;
  return guessRecipeCategories(recipe);
}

export function toggleRecipeCategory(
  current: Iterable<unknown> | undefined,
  category: RecipeCategory,
): RecipeCategory[] {
  const next = normalizeRecipeCategories(current ? [...current] : []);
  return next.includes(category)
    ? next.filter((item) => item !== category)
    : [...next, category];
}

export function recipeMatchesCategory(
  recipe: Pick<SavedRecipe, "categories">,
  category: RecipeCategory,
): boolean {
  return (recipe.categories ?? []).includes(category);
}
