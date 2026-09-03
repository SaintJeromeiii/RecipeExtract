import { extractRecipe as extractFromPage } from "../../shared/extract";
import type { GroceryItem, Recipe, RecipePatch, SavedRecipe } from "./types";
import {
  addGroceryLines,
  clearCheckedGrocery as clearChecked,
  listGrocery as readGrocery,
  listRecipes,
  removeGroceryItem,
  removeRecipe,
  saveRecipe as persistRecipe,
  setGroceryChecked,
  updateRecipe,
} from "./localStore";

export async function extractRecipe(url: string): Promise<Recipe> {
  return extractFromPage(url);
}

export async function listSavedRecipes(): Promise<SavedRecipe[]> {
  return listRecipes();
}

export async function saveRecipe(recipe: Recipe): Promise<SavedRecipe> {
  return persistRecipe(recipe);
}

export async function updateSavedRecipe(
  id: string,
  patch: RecipePatch,
): Promise<SavedRecipe> {
  return updateRecipe(id, patch);
}

export async function setRecipeFavorite(
  id: string,
  favorite: boolean,
): Promise<SavedRecipe> {
  return updateSavedRecipe(id, { favorite });
}

export async function removeSavedRecipe(id: string): Promise<void> {
  await removeRecipe(id);
}

export async function listGrocery(): Promise<GroceryItem[]> {
  return readGrocery();
}

export async function addGrocery(input: {
  ingredients: string[];
  recipeId?: string;
  recipeTitle?: string;
}): Promise<GroceryItem[]> {
  return addGroceryLines(input);
}

export async function setGroceryItemChecked(
  id: string,
  checked: boolean,
): Promise<GroceryItem> {
  return setGroceryChecked(id, checked);
}

export async function removeGrocery(id: string): Promise<void> {
  await removeGroceryItem(id);
}

export async function clearCheckedGrocery(): Promise<GroceryItem[]> {
  return clearChecked();
}
