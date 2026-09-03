import Constants from "expo-constants";
import { Platform } from "react-native";
import { extractRecipe as extractFromPage } from "../../shared/extract";
import { isSocialUrl, recipeFromCaption } from "../../shared/socialExtract";
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
  let response: Response;
  try {
    response = await fetch(`${base}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new Error(
      `Can't reach the recipe service at ${base}. Keep the extractor running, or paste the Reel caption text instead.`,
    );
  }
  const data = (await response.json()) as Recipe & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Could not extract that recipe.");
  }
  return data;
}

export async function extractRecipe(url: string): Promise<Recipe> {
  // Social Reels need the server (yt-dlp). Blog pages work on-device.
  if (isSocialUrl(url)) {
    return extractViaApi(url);
  }
  return extractFromPage(url);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, sourceUrl }),
    });
    if (response.ok) {
      return (await response.json()) as Recipe;
    }
  } catch {
    // Offline / no server — parse on device.
  }

  return recipeFromCaption(trimmed, sourceUrl || "https://pasted.local/caption");
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
