import { createKitchenStore } from "../shared/kitchenStore";

const STORAGE_KEY = "recipeextract.store.v1";

const kitchen = createKitchenStore({
  async read() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  async write(value: string) {
    localStorage.setItem(STORAGE_KEY, value);
  },
});

export const listSavedRecipes = kitchen.listRecipes;
export const saveRecipe = kitchen.saveRecipe;
export const updateSavedRecipe = kitchen.updateRecipe;
export const removeSavedRecipe = kitchen.removeRecipe;
export const listGrocery = kitchen.listGrocery;
export const addGrocery = kitchen.addGroceryLines;
export const setGroceryItemChecked = kitchen.setGroceryChecked;
export const setGroceryItemCategory = kitchen.setGroceryCategory;
export const removeGrocery = kitchen.removeGroceryItem;
export const clearCheckedGrocery = kitchen.clearCheckedGrocery;
export const clearAllGrocery = kitchen.clearAllGrocery;
export const setAllGroceryChecked = kitchen.setAllGroceryChecked;
export const setGroceryCategoryOrder = kitchen.setGroceryCategoryOrder;
export const listWeeklyMeals = kitchen.listWeekly;
export const addWeeklyMeal = kitchen.addWeeklyMeal;
export const updateWeeklyMeal = kitchen.updateWeeklyMeal;
export const removeWeeklyMeal = kitchen.removeWeeklyMeal;
export const clearWeeklyMeals = kitchen.clearWeekly;
export const exportKitchen = kitchen.exportStore;
export const importKitchen = kitchen.importStore;

export async function setRecipeFavorite(id: string, favorite: boolean) {
  return updateSavedRecipe(id, { favorite });
}
