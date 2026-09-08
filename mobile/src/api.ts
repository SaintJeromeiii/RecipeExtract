import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { extractRecipe as extractFromPage } from "../../shared/extract";
import {
  extractSocialRecipe,
  isSocialUrl,
  normalizeSourceUrl,
  recipeFromCaption,
  socialPlatform,
} from "../../shared/socialExtract";
import { CAPTION_FALLBACK, recipeLooksEmpty } from "../../shared/recipeQuality";
import type {
  GroceryCategory,
  GroceryItem,
  GroceryListState,
  Recipe,
  RecipePatch,
  SavedRecipe,
  Weekday,
  WeeklyMeal,
} from "./types";
import {
  addGroceryLines,
  addWeeklyMeal as persistWeeklyMeal,
  clearAllGrocery as clearAll,
  clearCheckedGrocery as clearChecked,
  clearWeekly,
  listGrocery as readGrocery,
  listRecipes,
  listWeekly,
  removeGroceryItem,
  removeRecipe,
  removeWeeklyMeal as deleteWeeklyMeal,
  saveRecipe as persistRecipe,
  setAllGroceryChecked as setAllChecked,
  setGroceryCategory,
  setGroceryCategoryOrder as persistCategoryOrder,
  setGroceryChecked,
  updateRecipe,
  updateWeeklyMeal as persistWeeklyPatch,
  exportStore,
  importStore,
} from "./localStore";

const HOUSEHOLD_KEY_STORAGE = "recipeextract.household-key";
let householdKey = "";

export async function loadHouseholdKey(): Promise<string> {
  householdKey = ((await AsyncStorage.getItem(HOUSEHOLD_KEY_STORAGE)) || "").trim();
  return householdKey;
}

export async function saveHouseholdKey(value: string): Promise<string> {
  householdKey = value.trim();
  if (householdKey) await AsyncStorage.setItem(HOUSEHOLD_KEY_STORAGE, householdKey);
  else await AsyncStorage.removeItem(HOUSEHOLD_KEY_STORAGE);
  return householdKey;
}

function extractHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (householdKey) headers["X-RecipeGuru-Key"] = householdKey;
  return headers;
}

const API_PORT = 8787;

function hostFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  try {
    const withProtocol = uri.includes("://") ? uri : `http://${uri}`;
    const hostname = new URL(withProtocol).hostname;
    return hostname || null;
  } catch {
    const host = uri.replace(/^[a-z]+:\/\//i, "").split("/")[0]?.split(":")[0];
    return host || null;
  }
}

function isTunnelHost(host: string): boolean {
  return (
    host.endsWith(".exp.direct") ||
    host.endsWith(".exp.host") ||
    host.endsWith(".expo.dev")
  );
}

/** Prefer a baked-in production API, then LAN/dev, for social Reel extraction. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl?.trim()) return extra.apiUrl.trim().replace(/\/$/, "");

  const candidates = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
  ];

  for (const candidate of candidates) {
    const host = hostFromUri(candidate);
    if (!host || isTunnelHost(host)) continue;
    if (host === "localhost" || host === "127.0.0.1") {
      if (Platform.OS === "android") return `http://10.0.2.2:${API_PORT}`;
      return `http://127.0.0.1:${API_PORT}`;
    }
    return `http://${host}:${API_PORT}`;
  }

  if (Platform.OS === "android") return `http://10.0.2.2:${API_PORT}`;
  return `http://127.0.0.1:${API_PORT}`;
}

async function extractViaApi(url: string): Promise<Recipe> {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  let response: Response;
  try {
    response = await fetch(`${base}/api/extract`, {
      method: "POST",
      headers: extractHeaders(),
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(CAPTION_FALLBACK);
    }
    throw new Error(
      `Can't reach the recipe service at ${base}. Keep the extractor running, or paste the Reel caption text instead.`,
    );
  } finally {
    clearTimeout(timer);
  }
  const data = (await response.json()) as Recipe & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Could not extract that recipe.");
  }
  if (recipeLooksEmpty(data)) {
    throw new Error(CAPTION_FALLBACK);
  }
  return data;
}

export async function extractRecipe(url: string): Promise<Recipe> {
  const normalized = normalizeSourceUrl(url);
  // Social Reels need the server (yt-dlp / Gemini). Blog pages work on-device.
  if (isSocialUrl(normalized)) {
    try {
      return await extractViaApi(normalized);
    } catch (apiError) {
      if (socialPlatform(normalized) === "tiktok") {
        try {
          const social = await extractSocialRecipe(normalized);
          if (!recipeLooksEmpty(social)) return social;
        } catch {
          // Keep the API error — it is usually the clearer message.
        }
      }
      throw apiError;
    }
  }
  const pageRecipe = await extractFromPage(normalized);
  if (recipeLooksEmpty(pageRecipe)) {
    throw new Error(CAPTION_FALLBACK);
  }
  return pageRecipe;
}

export async function extractRecipeFromCaption(
  text: string,
  sourceUrl?: string,
): Promise<Recipe> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Paste the recipe caption text to continue.");
  }

  // Prefer server (optional Gemini refine); fall back to on-device parsing.
  const base = getApiBaseUrl();
  try {
    const response = await fetch(`${base}/api/extract-text`, {
      method: "POST",
      headers: extractHeaders(),
      body: JSON.stringify({ text: trimmed, sourceUrl }),
    });
    if (response.ok) {
      const data = (await response.json()) as Recipe;
      if (!recipeLooksEmpty(data)) return data;
    }
  } catch {
    // Offline / no server — parse on device.
  }

  const local = recipeFromCaption(trimmed, sourceUrl || "https://pasted.local/caption");
  if (recipeLooksEmpty(local)) {
    throw new Error("That text doesn't look like a recipe yet. Include ingredients and steps.");
  }
  return local;
}

export async function exportKitchen(): Promise<string> {
  return exportStore();
}

export async function importKitchen(raw: string) {
  return importStore(raw);
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

export async function listGrocery(): Promise<GroceryListState> {
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

export async function setGroceryItemCategory(
  id: string,
  category: GroceryCategory,
): Promise<GroceryItem> {
  return setGroceryCategory(id, category);
}

export async function removeGrocery(id: string): Promise<void> {
  await removeGroceryItem(id);
}

export async function clearCheckedGrocery(): Promise<GroceryItem[]> {
  return clearChecked();
}

export async function clearAllGrocery(): Promise<GroceryItem[]> {
  return clearAll();
}

export async function setAllGroceryChecked(checked: boolean): Promise<GroceryItem[]> {
  return setAllChecked(checked);
}

export async function setGroceryCategoryOrder(
  categoryOrder: GroceryCategory[],
): Promise<GroceryCategory[]> {
  return persistCategoryOrder(categoryOrder);
}

export async function listWeeklyMeals(): Promise<WeeklyMeal[]> {
  return listWeekly();
}

export async function addWeeklyMeal(input: {
  title?: string;
  recipeId?: string;
  ingredients?: string[];
  weekday?: Weekday | null;
}): Promise<{ meal: WeeklyMeal; grocery: GroceryItem[] }> {
  return persistWeeklyMeal(input);
}

export async function updateWeeklyMeal(
  id: string,
  patch: { weekday?: Weekday | null; title?: string; checked?: boolean },
): Promise<WeeklyMeal> {
  return persistWeeklyPatch(id, patch);
}

export async function removeWeeklyMeal(id: string): Promise<void> {
  await deleteWeeklyMeal(id);
}

export async function clearWeeklyMeals(): Promise<WeeklyMeal[]> {
  return clearWeekly();
}
