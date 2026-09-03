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

export type SavedRecipe = Recipe & {
  id: string;
  savedAt: string;
  favorite: boolean;
  notes: string;
  tags: string[];
};

export type RecipePatch = Partial<
  Pick<
    SavedRecipe,
    | "favorite"
    | "notes"
    | "tags"
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
