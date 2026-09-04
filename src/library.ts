import type { GroceryCategory, GroceryItem, Recipe, RecipePatch, SavedRecipe } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export async function listSavedRecipes(): Promise<SavedRecipe[]> {
  const response = await fetch("/api/recipes");
  const data = await readJson<{ recipes: SavedRecipe[] }>(response);
  return data.recipes;
}

export async function saveRecipe(recipe: Recipe): Promise<SavedRecipe> {
  const response = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
  });
  return readJson<SavedRecipe>(response);
}

export async function updateSavedRecipe(
  id: string,
  patch: RecipePatch,
): Promise<SavedRecipe> {
  const response = await fetch(`/api/recipes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return readJson<SavedRecipe>(response);
}

export async function setRecipeFavorite(
  id: string,
  favorite: boolean,
): Promise<SavedRecipe> {
  return updateSavedRecipe(id, { favorite });
}

export async function removeSavedRecipe(id: string): Promise<void> {
  const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  await readJson<void>(response);
}

export async function listGrocery(): Promise<GroceryItem[]> {
  const response = await fetch("/api/grocery");
  const data = await readJson<{ items: GroceryItem[] }>(response);
  return data.items;
}

export async function addGrocery(input: {
  ingredients: string[];
  recipeId?: string;
  recipeTitle?: string;
}): Promise<GroceryItem[]> {
  const response = await fetch("/api/grocery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ items: GroceryItem[] }>(response);
  return data.items;
}

export async function setGroceryItemChecked(
  id: string,
  checked: boolean,
): Promise<GroceryItem> {
  const response = await fetch(`/api/grocery/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checked }),
  });
  return readJson<GroceryItem>(response);
}

export async function setGroceryItemCategory(
  id: string,
  category: GroceryCategory,
): Promise<GroceryItem> {
  const response = await fetch(`/api/grocery/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  return readJson<GroceryItem>(response);
}

export async function removeGrocery(id: string): Promise<void> {
  const response = await fetch(`/api/grocery/${id}`, { method: "DELETE" });
  await readJson<void>(response);
}

export async function clearCheckedGrocery(): Promise<GroceryItem[]> {
  const response = await fetch("/api/grocery/checked", { method: "DELETE" });
  const data = await readJson<{ items: GroceryItem[] }>(response);
  return data.items;
}
