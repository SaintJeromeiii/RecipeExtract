import { guessGroceryCategory, resolveCategoryOrder } from "./groceryCategories";
import {
  guessRecipeCategories,
  hydrateRecipeCategories,
  normalizeRecipeCategories,
} from "./recipeCategories";
import {
  compactGroceryList,
  formatGroceryLabel,
  groceryKey,
  mergeGroceryItem,
  normalizeGroceryName,
  parseIngredient,
} from "./ingredients";
import { hydrateWeeklyMeal, isWeekday, sortWeeklyMeals } from "./weekly";
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

export type KitchenStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
};

type StoreFile = {
  recipes: SavedRecipe[];
  grocery: GroceryItem[];
  groceryCategoryOrder: GroceryCategory[];
  weekly: WeeklyMeal[];
};

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
    categories: hydrateRecipeCategories(input, recipe),
  };
}

function emptyStore(): StoreFile {
  return {
    recipes: [],
    grocery: [],
    groceryCategoryOrder: resolveCategoryOrder(),
    weekly: [],
  };
}

function parseStore(raw: string | null): StoreFile {
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Partial<StoreFile>;
    return {
      recipes: Array.isArray(parsed.recipes)
        ? parsed.recipes.map(hydrateSaved).filter((item): item is SavedRecipe => Boolean(item))
        : [],
      grocery: compactGroceryList(Array.isArray(parsed.grocery) ? parsed.grocery : []),
      groceryCategoryOrder: resolveCategoryOrder(parsed.groceryCategoryOrder),
      weekly: Array.isArray(parsed.weekly)
        ? parsed.weekly.map(hydrateWeeklyMeal).filter((item): item is WeeklyMeal => Boolean(item))
        : [],
    };
  } catch {
    return emptyStore();
  }
}

function sorted(recipes: SavedRecipe[]): SavedRecipe[] {
  return [...recipes].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.savedAt.localeCompare(a.savedAt);
  });
}

export function createKitchenStore(storage: KitchenStorage) {
  let cache: StoreFile | null = null;
  let writeLock = Promise.resolve();

  async function loadStore(): Promise<StoreFile> {
    if (cache) {
      cache.weekly ??= [];
      return cache;
    }
    try {
      cache = parseStore(await storage.read());
    } catch {
      cache = emptyStore();
    }
    return cache;
  }

  async function persist(store: StoreFile): Promise<void> {
    cache = store;
    writeLock = writeLock.then(async () => {
      await storage.write(JSON.stringify(store));
    });
    await writeLock;
  }

  async function listRecipes(): Promise<SavedRecipe[]> {
    const store = await loadStore();
    return sorted(store.recipes);
  }

  async function saveRecipe(input: unknown): Promise<SavedRecipe> {
    const recipe = asRecipe(input);
    if (!recipe) {
      throw new Error("That recipe is missing a title or source URL.");
    }
    const incoming = input as Partial<SavedRecipe>;
    const store = await loadStore();
    const key = normalizeUrl(recipe.sourceUrl);
    const existing = store.recipes.find((item) => normalizeUrl(item.sourceUrl) === key);
    const saved: SavedRecipe =
      existing
        ? {
            ...recipe,
            id: existing.id,
            savedAt: existing.savedAt,
            favorite: existing.favorite,
            notes: existing.notes,
            tags: existing.tags,
            categories: existing.categories,
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
            categories: normalizeRecipeCategories(incoming.categories).length
              ? normalizeRecipeCategories(incoming.categories)
              : guessRecipeCategories(recipe),
          };
    store.recipes = [saved, ...store.recipes.filter((item) => item.id !== saved.id)];
    await persist(store);
    return saved;
  }

  async function updateRecipe(id: string, patch: RecipePatch): Promise<SavedRecipe> {
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
      ...("categories" in patch
        ? { categories: normalizeRecipeCategories(patch.categories) }
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

  async function removeRecipe(id: string): Promise<void> {
    const store = await loadStore();
    if (!store.recipes.some((item) => item.id === id)) {
      throw new Error("That saved recipe was not found.");
    }
    store.recipes = store.recipes.filter((item) => item.id !== id);
    store.weekly = store.weekly.map((meal) =>
      meal.recipeId === id ? { ...meal, recipeId: null } : meal,
    );
    await persist(store);
  }

  async function listGrocery(): Promise<GroceryListState> {
    const store = await loadStore();
    return {
      items: store.grocery,
      categoryOrder: resolveCategoryOrder(store.groceryCategoryOrder),
    };
  }

  async function addGroceryLines(input: {
    ingredients: string[];
    recipeId?: string;
    recipeTitle?: string;
  }): Promise<GroceryItem[]> {
    const store = await loadStore();
    for (const line of input.ingredients) {
      const parsed = parseIngredient(line);
      if (!parsed.name) continue;
      parsed.name = normalizeGroceryName(parsed.name);
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
          category: guessGroceryCategory(parsed.name),
          label: "",
        };
        created.label = formatGroceryLabel({ ...created, raw: parsed.raw });
        store.grocery.push(created);
      }
    }
    store.grocery = compactGroceryList(store.grocery);
    await persist(store);
    return store.grocery;
  }

  async function patchGroceryItem(
    id: string,
    patch: { checked?: boolean; category?: GroceryCategory },
  ): Promise<GroceryItem> {
    const store = await loadStore();
    const current = store.grocery.find((item) => item.id === id);
    if (!current) throw new Error("That grocery item was not found.");
    const next = { ...current, ...patch };
    store.grocery = store.grocery.map((item) => (item.id === id ? next : item));
    await persist(store);
    return next;
  }

  async function setGroceryChecked(id: string, checked: boolean): Promise<GroceryItem> {
    return patchGroceryItem(id, { checked });
  }

  async function setGroceryCategory(
    id: string,
    category: GroceryCategory,
  ): Promise<GroceryItem> {
    return patchGroceryItem(id, { category });
  }

  async function removeGroceryItem(id: string): Promise<void> {
    const store = await loadStore();
    store.grocery = store.grocery.filter((item) => item.id !== id);
    await persist(store);
  }

  async function clearCheckedGrocery(): Promise<GroceryItem[]> {
    const store = await loadStore();
    store.grocery = store.grocery.filter((item) => !item.checked);
    await persist(store);
    return store.grocery;
  }

  async function clearAllGrocery(): Promise<GroceryItem[]> {
    const store = await loadStore();
    store.grocery = [];
    await persist(store);
    return store.grocery;
  }

  async function setAllGroceryChecked(checked: boolean): Promise<GroceryItem[]> {
    const store = await loadStore();
    store.grocery = store.grocery.map((item) => ({ ...item, checked }));
    await persist(store);
    return store.grocery;
  }

  async function setGroceryCategoryOrder(order: unknown): Promise<GroceryCategory[]> {
    const store = await loadStore();
    store.groceryCategoryOrder = resolveCategoryOrder(order);
    await persist(store);
    return store.groceryCategoryOrder;
  }

  async function listWeekly(): Promise<WeeklyMeal[]> {
    const store = await loadStore();
    return sortWeeklyMeals(store.weekly);
  }

  async function addWeeklyMeal(input: {
    title?: string;
    recipeId?: string;
    ingredients?: string[];
    weekday?: Weekday | null;
  }): Promise<{ meal: WeeklyMeal; grocery: GroceryItem[] }> {
    const store = await loadStore();
    let title = typeof input.title === "string" ? input.title.trim() : "";
    const recipeId = typeof input.recipeId === "string" && input.recipeId ? input.recipeId : null;
    let shopLines = Array.isArray(input.ingredients)
      ? input.ingredients.filter(
          (item): item is string => typeof item === "string" && Boolean(item.trim()),
        )
      : [];

    if (recipeId) {
      const recipe = store.recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        throw new Error("Save that recipe first, then add it to the week.");
      }
      title = title || recipe.title;
      if (!shopLines.length) shopLines = recipe.ingredients;
    }

    if (!title) {
      throw new Error("Give this meal a name.");
    }

    const meal: WeeklyMeal = {
      id: newId(),
      title,
      recipeId,
      ingredients: recipeId ? [] : shopLines,
      weekday: isWeekday(input.weekday) ? input.weekday : null,
      checked: false,
      addedAt: new Date().toISOString(),
    };
    store.weekly = [...store.weekly, meal];
    await persist(store);

    if (!shopLines.length && !recipeId) {
      shopLines = [title];
    }
    const grocery = shopLines.length
      ? await addGroceryLines({
          ingredients: shopLines,
          recipeId: recipeId ?? undefined,
          recipeTitle: title,
        })
      : store.grocery;
    return { meal, grocery };
  }

  async function updateWeeklyMeal(
    id: string,
    patch: { weekday?: Weekday | null; title?: string; checked?: boolean },
  ): Promise<WeeklyMeal> {
    const store = await loadStore();
    const current = store.weekly.find((item) => item.id === id);
    if (!current) throw new Error("That weekly meal was not found.");
    const next: WeeklyMeal = {
      ...current,
      title:
        typeof patch.title === "string" && patch.title.trim() ? patch.title.trim() : current.title,
      weekday:
        "weekday" in patch ? (isWeekday(patch.weekday) ? patch.weekday : null) : current.weekday,
      checked: typeof patch.checked === "boolean" ? patch.checked : current.checked,
    };
    store.weekly = store.weekly.map((item) => (item.id === id ? next : item));
    await persist(store);
    return next;
  }

  async function removeWeeklyMeal(id: string): Promise<void> {
    const store = await loadStore();
    store.weekly = store.weekly.filter((item) => item.id !== id);
    await persist(store);
  }

  async function clearWeekly(): Promise<WeeklyMeal[]> {
    const store = await loadStore();
    store.weekly = [];
    await persist(store);
    return [];
  }

  async function exportStore(): Promise<string> {
    const store = await loadStore();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: store.recipes,
        grocery: store.grocery,
        groceryCategoryOrder: store.groceryCategoryOrder,
        weekly: store.weekly,
      },
      null,
      2,
    );
  }

  async function importStore(raw: string): Promise<{ recipes: number; grocery: number; weekly: number }> {
    const incoming = parseStore(raw);
    const store = await loadStore();
    const recipeIds = new Set(store.recipes.map((item) => item.id));
    const recipeUrls = new Set(store.recipes.map((item) => normalizeUrl(item.sourceUrl)));
    for (const recipe of incoming.recipes) {
      const url = normalizeUrl(recipe.sourceUrl);
      if (recipeIds.has(recipe.id) || recipeUrls.has(url)) continue;
      store.recipes.push(recipe);
      recipeIds.add(recipe.id);
      recipeUrls.add(url);
    }
    const groceryIds = new Set(store.grocery.map((item) => item.id));
    const groceryKeys = new Set(store.grocery.filter((item) => !item.checked).map((item) => item.key));
    for (const item of incoming.grocery) {
      if (groceryIds.has(item.id) || groceryKeys.has(item.key)) continue;
      store.grocery.push(item);
      groceryIds.add(item.id);
    }
    store.grocery = compactGroceryList(store.grocery);
    const weeklyIds = new Set(store.weekly.map((item) => item.id));
    for (const meal of incoming.weekly) {
      if (weeklyIds.has(meal.id)) continue;
      store.weekly.push(meal);
    }
    await persist(store);
    return {
      recipes: incoming.recipes.length,
      grocery: incoming.grocery.length,
      weekly: incoming.weekly.length,
    };
  }

  return {
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
  };
}
