export type Recipe = {
  title: string;
  description: string | null;
  image: string | null;
  author: string | null;
  sourceUrl: string;
  sourceName: string | null;
  yield: string | null;
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  ingredients: string[];
  steps: string[];
};

export type RecipeCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "drinks"
  | "snacks"
  | "dessert"
  | "sides"
  | "other";

export type SavedRecipe = Recipe & {
  id: string;
  savedAt: string;
  favorite: boolean;
  notes: string;
  tags: string[];
  categories: RecipeCategory[];
};

export type RecipePatch = Partial<
  Pick<
    SavedRecipe,
    | "favorite"
    | "notes"
    | "tags"
    | "categories"
    | "title"
    | "description"
    | "yield"
    | "ingredients"
    | "steps"
    | "prepTime"
    | "cookTime"
    | "totalTime"
  >
>;

export type GroceryCategory =
  | "produce"
  | "fruit"
  | "meat"
  | "seafood"
  | "dairy"
  | "bakery"
  | "pantry"
  | "other";

export type GroceryItem = {
  id: string;
  key: string;
  label: string;
  amount: number | null;
  unit: string | null;
  name: string;
  checked: boolean;
  recipeIds: string[];
  recipeTitles: string[];
  category?: GroceryCategory;
};

export type GroceryListState = {
  items: GroceryItem[];
  categoryOrder: GroceryCategory[];
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WeeklyMeal = {
  id: string;
  title: string;
  recipeId: string | null;
  ingredients: string[];
  weekday: Weekday | null;
  checked: boolean;
  addedAt: string;
};

export type ParsedIngredient = {
  amount: number | null;
  unit: string | null;
  name: string;
  raw: string;
};

export type TimerMatch = {
  start: number;
  end: number;
  seconds: number;
  label: string;
};
