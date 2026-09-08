import AsyncStorage from "@react-native-async-storage/async-storage";
import { createKitchenStore } from "../../shared/kitchenStore";

const STORAGE_KEY = "recipeextract.store.v1";

const kitchen = createKitchenStore({
  read: () => AsyncStorage.getItem(STORAGE_KEY),
  write: (value) => AsyncStorage.setItem(STORAGE_KEY, value),
});

export const {
  listRecipes,
  saveRecipe,
  updateRecipe,
  removeRecipe,
  listGrocery,
  addGroceryLines,
  setGroceryChecked,
  setGroceryCategory,
  removeGroceryItem,
  clearCheckedGrocery,
  clearAllGrocery,
  setAllGroceryChecked,
  setGroceryCategoryOrder,
  listWeekly,
  addWeeklyMeal,
  updateWeeklyMeal,
  removeWeeklyMeal,
  clearWeekly,
  exportStore,
  importStore,
} = kitchen;
