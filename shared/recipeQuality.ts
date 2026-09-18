import type { Recipe } from "./types";

export const CAPTION_FALLBACK =
  "Couldn't pull a usable recipe from that link. Copy the caption (ingredients and steps), switch to Caption text, and paste it.";

export const EXTRACT_WAIT_HINT =
  "Reading the post — this can take about 20 seconds. Keep the app open.";

export function recipeLooksEmpty(recipe: Recipe): boolean {
  const ingredients = recipe.ingredients.filter((line) => line.trim()).length;
  const steps = recipe.steps.filter((line) => line.trim()).length;
  return ingredients === 0 && steps <= 1;
}

export const SAMPLE_RECIPE: Recipe = {
  title: "Weeknight skillet pasta",
  description: "A sample recipe so you can try Save, This week, Grocery, and Cook without a link.",
  image: null,
  author: "Pluck",
  sourceUrl: "https://recipeextract.local/sample/skillet-pasta",
  sourceName: "Pluck sample",
  yield: "4 servings",
  prepTime: "10 min",
  cookTime: "20 min",
  totalTime: "30 min",
  ingredients: [
    "12 oz pasta",
    "2 tbsp olive oil",
    "3 garlic cloves, minced",
    "1 pint cherry tomatoes",
    "2 cups baby spinach",
    "1/2 tsp salt",
    "1/4 tsp black pepper",
    "1/2 cup grated parmesan",
  ],
  steps: [
    "Boil the pasta in salted water until just shy of al dente. Save 1/2 cup of pasta water, then drain.",
    "Warm the olive oil in a wide skillet over medium heat. Add garlic and cook 30 seconds.",
    "Add the tomatoes and a pinch of salt. Cook until they slump and burst, about 8 minutes.",
    "Add pasta, spinach, pepper, and a splash of pasta water. Toss until the spinach wilts.",
    "Take off the heat, fold in parmesan, and add more pasta water if it looks dry. Taste for salt.",
  ],
};
