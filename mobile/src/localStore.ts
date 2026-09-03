import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  formatGroceryLabel,
  groceryKey,
  mergeGroceryItem,
  parseIngredient,
} from "../../shared/ingredients";
import type {
  GroceryItem,
  Recipe,
  RecipePatch,
  SavedRecipe,
} from "../../shared/types";

const STORAGE_KEY = "recipeextract.store.v1";

type StoreFile = {
  recipes: SavedRecipe[];
  grocery: GroceryItem[];
};

let cache: StoreFile | null = null;
let writeLock = Promise.resolve();

function newId(): string {
  const maybeCrypto = globalThis.crypto as undefined | { randomUUID?: () => string };
  if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function asRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<Recipe>;
  if (typeof input.title !== "string" || !input.title.trim()) return null;
  if (typeof input.sourceUrl !== "string" || !input.sourceUrl.trim()) return null;
  return {
    title: input.title.trim(),
    description: input.description ?? null,
    image: input.image ?? null,
    author: input.author ?? null,
    sourceUrl: input.sourceUrl.trim(),
    sourceName: input.sourceName ?? null,
    yield: input.yield ?? null,
    prepTime: input.prepTime ?? null,
    cookTime: input.cookTime ?? null,
    totalTime: input.totalTime ?? null,
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.filter((item): item is string => typeof item === "string")
      : [],
    steps: Array.isArray(input.steps)
      ? input.steps.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function hydrateSaved(value: unknown): SavedRecipe | null {
  const recipe = asRecipe(value);
  if (!recipe || !value || typeof value !== "object") return null;
  const input = value as Partial<SavedRecipe>;
  if (typeof input.id !== "string") return null;
  return {
    ...recipe,
    id: input.id,
    savedAt: typeof input.savedAt === "string" ? input.savedAt : new Date().toISOString(),
    favorite: Boolean(input.favorite),
    notes: typeof input.notes === "string" ? input.notes : "",
    tags: Array.isArray(input.tags)
      ? input.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()))
      : [],
  };
}

async function loadStore(): Promise<StoreFile> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoreFile>) : {};
    cache = {
      recipes: Array.isArray(parsed.recipes)
        ? parsed.recipes.map(hydrateSaved).filter((item): item is SavedRecipe => Boolean(item))
        : [],
      grocery: Array.isArray(parsed.grocery) ? parsed.grocery : [],
    };
  } catch {
    cache = { recipes: [], grocery: [] };
  }
  return cache;
}

async function persist(store: StoreFile): Promise<void> {
  cache = store;
  writeLock = writeLock.then(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  });
  await writeLock;
}

function sorted(recipes: SavedRecipe[]): SavedRecipe[] {
  return [...recipes].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.savedAt.localeCompare(a.savedAt);
  });
}

export async function listRecipes(): Promise<SavedRecipe[]> {
  const store = await loadStore();
  return sorted(store.recipes);
}

export async function saveRecipe(input: unknown): Promise<SavedRecipe> {
  const recipe = asRecipe(input);
  if (!recipe) {
    throw new Error("That recipe is missing a title or source URL.");
  }
  const incoming = input as Partial<SavedRecipe>;
  const store = await loadStore();
  const key = normalizeUrl(recipe.sourceUrl);
  const existing = store.recipes.find(
    (item) => normalizeUrl(item.sourceUrl) === key,
  );
  const saved: SavedRecipe = existing
    ? {
        ...recipe,
        id: existing.id,
        savedAt: existing.savedAt,
        favorite: existing.favorite,
        notes: existing.notes,
        tags: existing.tags,
      }
    : {
        ...recipe,
        id: newId(),
        savedAt: new Date().toISOString(),
        favorite: false,
        notes: typeof incoming.notes === "string" ? incoming.notes : "",
        tags: Array.isArray(incoming.tags)
          ? incoming.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
      };
  store.recipes = [saved, ...store.recipes.filter((item) => item.id !== saved.id)];
  await persist(store);
  return saved;
}

export async function updateRecipe(
  id: string,
  patch: RecipePatch,
): Promise<SavedRecipe> {
  const store = await loadStore();
  const current = store.recipes.find((item) => item.id === id);
  if (!current) {
    throw new Error("That saved recipe was not found.");
  }
  const saved: SavedRecipe = {
    ...current,
    ...("favorite" in patch && typeof patch.favorite === "boolean"
      ? { favorite: patch.favorite }
      : {}),
    ...("notes" in patch && typeof patch.notes === "string" ? { notes: patch.notes } : {}),
    ...("tags" in patch && Array.isArray(patch.tags)
      ? {
          tags: patch.tags.filter(
            (tag): tag is string => typeof tag === "string" && Boolean(tag.trim()),
          ),
        }
      : {}),
    ...("title" in patch && typeof patch.title === "string" && patch.title.trim()
      ? { title: patch.title.trim() }
      : {}),
    ...("description" in patch ? { description: patch.description ?? null } : {}),
    ...("yield" in patch ? { yield: patch.yield ?? null } : {}),
    ...("prepTime" in patch ? { prepTime: patch.prepTime ?? null } : {}),
    ...("cookTime" in patch ? { cookTime: patch.cookTime ?? null } : {}),
    ...("totalTime" in patch ? { totalTime: patch.totalTime ?? null } : {}),
    ...("ingredients" in patch && Array.isArray(patch.ingredients)
      ? {
          ingredients: patch.ingredients.filter(
            (item): item is string => typeof item === "string",
          ),
        }
      : {}),
    ...("steps" in patch && Array.isArray(patch.steps)
      ? { steps: patch.steps.filter((item): item is string => typeof item === "string") }
      : {}),
  };
  store.recipes = store.recipes.map((item) => (item.id === id ? saved : item));
  await persist(store);
  return saved;
}

export async function removeRecipe(id: string): Promise<void> {
  const store = await loadStore();
  if (!store.recipes.some((item) => item.id === id)) {
    throw new Error("That saved recipe was not found.");
  }
  store.recipes = store.recipes.filter((item) => item.id !== id);
  await persist(store);
}

export async function listGrocery(): Promise<GroceryItem[]> {
  const store = await loadStore();
  return store.grocery;
}

export async function addGroceryLines(input: {
  ingredients: string[];
  recipeId?: string;
  recipeTitle?: string;
}): Promise<GroceryItem[]> {
  const store = await loadStore();
  for (const line of input.ingredients) {
    const parsed = parseIngredient(line);
    if (!parsed.name) continue;
    const key = groceryKey(parsed);
    const existing = store.grocery.find((item) => item.key === key && !item.checked);
    if (existing) {
      store.grocery = store.grocery.map((item) =>
        item.id === existing.id
          ? mergeGroceryItem(item, parsed, input.recipeId, input.recipeTitle)
          : item,
      );
    } else {
      const created: GroceryItem = {
        id: newId(),
        key,
        amount: parsed.amount,
        unit: parsed.unit,
        name: parsed.name,
        checked: false,
        recipeIds: input.recipeId ? [input.recipeId] : [],
        recipeTitles: input.recipeTitle ? [input.recipeTitle] : [],
        label: "",
      };
      created.label = formatGroceryLabel({ ...created, raw: parsed.raw });
      store.grocery.push(created);
    }
  }
  await persist(store);
  return store.grocery;
}

export async function setGroceryChecked(
  id: string,
  checked: boolean,
): Promise<GroceryItem> {
  const store = await loadStore();
  const current = store.grocery.find((item) => item.id === id);
  if (!current) throw new Error("That grocery item was not found.");
  const next = { ...current, checked };
  store.grocery = store.grocery.map((item) => (item.id === id ? next : item));
  await persist(store);
  return next;
}

export async function removeGroceryItem(id: string): Promise<void> {
  const store = await loadStore();
  store.grocery = store.grocery.filter((item) => item.id !== id);
  await persist(store);
}

export async function clearCheckedGrocery(): Promise<GroceryItem[]> {
  const store = await loadStore();
  store.grocery = store.grocery.filter((item) => !item.checked);
  await persist(store);
  return store.grocery;
}
