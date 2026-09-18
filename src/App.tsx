import { useEffect, useMemo, useState } from "react";
import { firstHttpUrl, isSocialUrl } from "../shared/social";
import { EXTRACT_WAIT_HINT, SAMPLE_RECIPE } from "../shared/recipeQuality";
import {
  groceryCategoryLabel,
  groupGroceryItems,
  itemGroceryCategory,
  moveCategoryOrder,
  resolveCategoryOrder,
} from "../shared/groceryCategories";
import {
  RECIPE_CATEGORIES,
  recipeCategoryLabel,
  toggleRecipeCategory,
} from "../shared/recipeCategories";
import { parseServings, scaleIngredientLine } from "../shared/ingredients";
import { recipeAsText } from "../shared/share-text";
import { StepWithTimers, useCookTimers, useWakeLock } from "./kitchen";
import {
  addGrocery,
  addWeeklyMeal,
  clearAllGrocery,
  clearCheckedGrocery,
  clearWeeklyMeals,
  listGrocery,
  listSavedRecipes,
  listWeeklyMeals,
  removeGrocery,
  removeSavedRecipe,
  removeWeeklyMeal,
  saveRecipe,
  setAllGroceryChecked,
  setGroceryCategoryOrder,
  setGroceryItemCategory,
  setGroceryItemChecked,
  setRecipeFavorite,
  updateSavedRecipe,
  updateWeeklyMeal,
} from "./library";
import { SavedLibrary } from "./SavedLibrary";
import { WeeklyMenu } from "./WeeklyMenu";
import type {
  GroceryCategory,
  GroceryItem,
  Recipe,
  RecipeCategory,
  SavedRecipe,
  WeeklyMeal,
} from "./types";

type LibraryFilter = "all" | "favorites" | RecipeCategory;

type View = "home" | "recipe";

const HOUSEHOLD_KEY_STORAGE = "recipeextract.household-key";

function webExtractHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const key = localStorage.getItem(HOUSEHOLD_KEY_STORAGE)?.trim();
    if (key) headers["X-RecipeGuru-Key"] = key;
  } catch {
    // Private mode / blocked storage.
  }
  return headers;
}

function recipeKey(recipe: Pick<Recipe, "sourceUrl">): string {
  return recipe.sourceUrl.replace(/\/$/, "");
}

export default function App() {
  const [url, setUrl] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "caption">("url");
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    () => new Set(),
  );
  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => new Set());
  const [cookOpen, setCookOpen] = useState(false);
  const [cookIndex, setCookIndex] = useState(0);
  const [showCookIngredients, setShowCookIngredients] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyMeal[]>([]);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<GroceryCategory[]>(() =>
    resolveCategoryOrder(),
  );
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [servings, setServings] = useState(4);
  const [baseServings, setBaseServings] = useState(4);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftYield, setDraftYield] = useState("");
  const [draftIngredients, setDraftIngredients] = useState("");
  const [draftSteps, setDraftSteps] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftTag, setDraftTag] = useState("");
  const [removedRecipe, setRemovedRecipe] = useState<SavedRecipe | null>(null);
  const [householdKey, setHouseholdKey] = useState("");
  const [householdSaved, setHouseholdSaved] = useState(false);
  const timers = useCookTimers();
  useWakeLock(cookOpen);

  const savedMatch = useMemo(() => {
    if (!recipe) return null;
    const key = recipeKey(recipe);
    return savedRecipes.find((item) => recipeKey(item) === key) ?? null;
  }, [recipe, savedRecipes]);

  const scale = servings / (baseServings || servings || 1);
  const scaledIngredients = useMemo(
    () => (recipe ? recipe.ingredients.map((line) => scaleIngredientLine(line, scale)) : []),
    [recipe, scale],
  );

  useEffect(() => {
    try {
      setHouseholdKey(localStorage.getItem(HOUSEHOLD_KEY_STORAGE) || "");
    } catch {
      // Private mode / blocked storage.
    }
    void listSavedRecipes().then(setSavedRecipes).catch(() => {});
    void listWeeklyMeals().then(setWeekly).catch(() => {});
    void listGrocery()
      .then(({ items, categoryOrder: order }) => {
        setGrocery(items);
        setCategoryOrder(order);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!removedRecipe) return;
    const timer = window.setTimeout(() => setRemovedRecipe(null), 8000);
    return () => window.clearTimeout(timer);
  }, [removedRecipe?.id]);

  useEffect(() => {
    if (!recipe) return;
    const parsed = parseServings(recipe.yield) ?? 4;
    setBaseServings(parsed);
    setServings(parsed);
    setEditing(false);
    setDraftTitle(recipe.title);
    setDraftYield(recipe.yield ?? "");
    setDraftIngredients(recipe.ingredients.join("\n"));
    setDraftSteps(recipe.steps.join("\n"));
    setDraftNotes(savedMatch?.notes ?? "");
  }, [recipe?.sourceUrl, recipe?.title, savedMatch?.id]);

  async function extract(nextUrl = url) {
    const trimmed = nextUrl.trim();
    if (!trimmed) {
      setError("Paste a recipe URL to get started.");
      return;
    }
    const extracted = firstHttpUrl(trimmed) || trimmed;
    setUrl(extracted);
    setLoading(true);
    setError(null);
    setCookOpen(false);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: webExtractHeaders(),
        body: JSON.stringify({ url: extracted }),
      });
      const data = (await response.json()) as Recipe & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not extract that recipe.");
      }
      setRecipe(data);
      setCheckedIngredients(new Set());
      setDoneSteps(new Set());
      setCookIndex(0);
      setView("recipe");
    } catch (err) {
      setRecipe(null);
      setView("home");
      setInputMode("caption");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function extractCaption(nextText = captionText) {
    const trimmed = nextText.trim();
    if (!trimmed) {
      setError("Paste the recipe caption text to continue.");
      return;
    }
    setCaptionText(trimmed);
    setLoading(true);
    setError(null);
    setCookOpen(false);
    try {
      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: webExtractHeaders(),
        body: JSON.stringify({
          text: trimmed,
          sourceUrl: url.trim() || undefined,
        }),
      });
      const data = (await response.json()) as Recipe & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not parse that caption.");
      }
      setRecipe(data);
      setCheckedIngredients(new Set());
      setDoneSteps(new Set());
      setCookIndex(0);
      setView("recipe");
    } catch (err) {
      setRecipe(null);
      setView("home");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function toggleIngredient(index: number) {
    setCheckedIngredients((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleStep(index: number) {
    setDoneSteps((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function openCook(index = 0) {
    setCookIndex(index);
    setCookOpen(true);
    setShowCookIngredients(false);
  }

  function openSaved(saved: SavedRecipe) {
    setUrl(saved.sourceUrl);
    setRecipe(saved);
    setCheckedIngredients(new Set());
    setDoneSteps(new Set());
    setCookIndex(0);
    setCookOpen(false);
    setError(null);
    setView("recipe");
  }

  function upsertSaved(saved: SavedRecipe) {
    setSavedRecipes((current) => [
      saved,
      ...current.filter((item) => item.id !== saved.id),
    ]);
    if (recipe && recipeKey(recipe) === recipeKey(saved)) {
      setRecipe({ ...saved });
    }
  }

  async function handleSave() {
    if (!recipe) return;
    setLibraryBusy(true);
    setError(null);
    try {
      upsertSaved(await saveRecipe(recipe));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that recipe.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleFavorite(saved: SavedRecipe | null) {
    setLibraryBusy(true);
    setError(null);
    try {
      const target = saved ?? (recipe ? await saveRecipe(recipe) : null);
      if (!target) return;
      upsertSaved(await setRecipeFavorite(target.id, !target.favorite));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update favorite.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleRemove(saved: SavedRecipe) {
    const ok = window.confirm(
      `Delete “${saved.title}” from your collection? You can undo for a few seconds.`,
    );
    if (!ok) return;
    setLibraryBusy(true);
    setError(null);
    try {
      await removeSavedRecipe(saved.id);
      setSavedRecipes((current) => current.filter((item) => item.id !== saved.id));
      setRemovedRecipe(saved);
      if (recipe && recipeKey(recipe) === recipeKey(saved)) {
        setView("home");
        setRecipe(null);
        setCookOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that recipe.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleUndoRemove() {
    if (!removedRecipe) return;
    setLibraryBusy(true);
    try {
      upsertSaved(await saveRecipe(removedRecipe));
      setRemovedRecipe(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore that recipe.");
    } finally {
      setLibraryBusy(false);
    }
  }

  function upsertWeekly(meal: WeeklyMeal) {
    setWeekly((current) => {
      const next = current.some((item) => item.id === meal.id)
        ? current.map((item) => (item.id === meal.id ? meal : item))
        : [...current, meal];
      return next;
    });
  }

  async function handleAddWeeklyRecipe(target: SavedRecipe) {
    setLibraryBusy(true);
    setError(null);
    try {
      const result = await addWeeklyMeal({ recipeId: target.id });
      upsertWeekly(result.meal);
      setGrocery(result.grocery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that meal to the week.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleAddWeeklyCustom(input: {
    title: string;
    ingredients: string[];
  }) {
    setLibraryBusy(true);
    setError(null);
    try {
      const result = await addWeeklyMeal(input);
      upsertWeekly(result.meal);
      setGrocery(result.grocery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that meal to the week.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleWeeklyFromRecipe() {
    if (!recipe) return;
    setLibraryBusy(true);
    setError(null);
    try {
      const saved = savedMatch ?? (await saveRecipe(recipe));
      if (!savedMatch) upsertSaved(saved);
      const result = await addWeeklyMeal({ recipeId: saved.id });
      upsertWeekly(result.meal);
      setGrocery(result.grocery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that meal to the week.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleRemoveWeekly(meal: WeeklyMeal) {
    try {
      await removeWeeklyMeal(meal.id);
      setWeekly((current) => current.filter((item) => item.id !== meal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that meal.");
    }
  }

  async function handleToggleWeekly(meal: WeeklyMeal, checked: boolean) {
    try {
      upsertWeekly(await updateWeeklyMeal(meal.id, { checked }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that meal.");
    }
  }

  async function handleClearWeekly() {
    try {
      setWeekly(await clearWeeklyMeals());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear the week.");
    }
  }

  async function handleShopRecipe(target: SavedRecipe) {
    if (!target.ingredients.length) {
      setError("That recipe has no ingredients to shop.");
      return;
    }
    setLibraryBusy(true);
    setError(null);
    try {
      setGrocery(
        await addGrocery({
          ingredients: target.ingredients,
          recipeId: target.id,
          recipeTitle: target.title,
        }),
      );
      setGroceryOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to the grocery list.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function handleAddGroceryLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      setGrocery(await addGrocery({ ingredients: [trimmed] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that item.");
    }
  }

  async function persistPatch(patch: Parameters<typeof updateSavedRecipe>[1]) {
    const target = savedMatch ?? (recipe ? await saveRecipe(recipe) : null);
    if (!target) return;
    upsertSaved(await updateSavedRecipe(target.id, patch));
  }

  async function handleEditSave() {
    if (!recipe) return;
    setLibraryBusy(true);
    setError(null);
    try {
      const ingredients = draftIngredients.split("\n").map((line) => line.trim()).filter(Boolean);
      const steps = draftSteps.split("\n").map((line) => line.trim()).filter(Boolean);
      const next = {
        ...recipe,
        title: draftTitle.trim() || recipe.title,
        yield: draftYield.trim() || null,
        ingredients,
        steps,
      };
      setRecipe(next);
      await persistPatch({
        title: next.title,
        yield: next.yield,
        ingredients,
        steps,
        notes: draftNotes,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that recipe.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function addTag(tag: string) {
    const clean = tag.trim().toLowerCase();
    if (!clean) return;
    const tags = Array.from(new Set([...(savedMatch?.tags ?? []), clean]));
    setDraftTag("");
    try {
      await persistPatch({ tags });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that tag.");
    }
  }

  async function removeTag(tag: string) {
    try {
      await persistPatch({
        tags: (savedMatch?.tags ?? []).filter((item) => item !== tag),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that tag.");
    }
  }

  async function handleAddGrocery() {
    if (!recipe) return;
    const ingredients = scaledIngredients.filter(
      (_line, index) => !checkedIngredients.has(index),
    );
    if (!ingredients.length) {
      setError("Uncheck the ingredients you still need, then add them.");
      return;
    }
    setLibraryBusy(true);
    try {
      setGrocery(
        await addGrocery({
          ingredients,
          recipeId: savedMatch?.id,
          recipeTitle: recipe.title,
        }),
      );
      setGroceryOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to the grocery list.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function shareRecipe() {
    if (!recipe) return;
    const text = recipeAsText(recipe, {
      notes: savedMatch?.notes,
      tags: savedMatch?.tags,
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, text, url: recipe.sourceUrl });
        return;
      }
    } catch {
      // Fall through to clipboard.
    }
    await navigator.clipboard.writeText(text);
  }

  const metaBits = useMemo(() => {
    if (!recipe) return [];
    return [
      `${servings} serving${servings === 1 ? "" : "s"}`,
      recipe.prepTime ? `Prep ${recipe.prepTime}` : null,
      recipe.cookTime ? `Cook ${recipe.cookTime}` : null,
      recipe.totalTime ? `Total ${recipe.totalTime}` : null,
    ].filter(Boolean) as string[];
  }, [recipe, servings]);

  const groceryCount = grocery.filter((item) => !item.checked).length;
  const weekRecipeIds = useMemo(
    () => new Set(weekly.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id))),
    [weekly],
  );
  const goHome = () => {
    setView("home");
    setCookOpen(false);
    setError(null);
  };

  return (
    <div className={view === "home" ? "min-h-screen bg-ivory font-sans text-ink scheme-light" : "app"}>
      {view === "home" ? (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-olive/15 bg-ivory px-5 py-4 md:px-10">
          <button
            type="button"
            className="flex items-center gap-2.5 border-0 bg-transparent p-0 font-display text-[1.65rem] tracking-tight text-espresso"
            onClick={goHome}
          >
            <img
              src="/owl-logo.png"
              alt=""
              className="h-10 w-10 rounded-2xl"
            />
            Pluck
          </button>
          <div className="flex items-center gap-2">
            <a
              href="#this-week"
              className="rounded-full border border-olive/20 px-4 py-2 text-[0.72rem] tracking-[0.16em] uppercase text-olive no-underline"
            >
              Week {weekly.length}
            </a>
            <button
              type="button"
              className="rounded-full border border-olive/20 px-4 py-2 text-[0.72rem] tracking-[0.16em] uppercase text-olive"
              onClick={() => setGroceryOpen(true)}
            >
              Market {groceryCount}
            </button>
          </div>
        </header>
      ) : (
        <header className="topbar">
          <button className="brand" onClick={goHome}>
            <span className="brand-mark" aria-hidden="true">
              <img src="/owl-logo.png" alt="" />
            </span>
            Pluck
          </button>
          <div className="topbar-actions">
            <button className="ghost" onClick={goHome}>
              Week {weekly.length}
            </button>
            <button className="ghost" onClick={() => setGroceryOpen(true)}>
              Grocery {groceryCount}
            </button>
            {view === "recipe" && recipe ? (
              <button className="ghost" onClick={() => openCook(0)}>
                Cook mode
              </button>
            ) : null}
          </div>
        </header>
      )}

      {view === "home" && (
        <main className="mx-auto max-w-[1180px] px-5 pb-28 pt-12 md:px-10 md:pt-16">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] uppercase text-terracotta">
            Skip the blog. Keep the recipe.
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.6rem,7vw,5.2rem)] leading-[0.95] tracking-tight text-espresso">
            Drop a ripe link.
            <em className="mt-1 block italic text-olive">Cook the actual recipe.</em>
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-olive/80">
            Clip a recipe-blog URL, a Reel, or the caption itself. Ingredients and
            steps land on the shelf below — ready to cook.
          </p>
          <div className="mt-8 max-w-2xl rounded-3xl border border-olive/15 bg-oatmeal p-3">
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-ivory p-1" role="tablist" aria-label="Paste type">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  inputMode === "url" ? "bg-olive text-ivory" : "bg-transparent text-olive"
                }`}
                onClick={() => setInputMode("url")}
              >
                URL
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  inputMode === "caption" ? "bg-olive text-ivory" : "bg-transparent text-olive"
                }`}
                onClick={() => setInputMode("caption")}
              >
                Caption text
              </button>
            </div>
            {inputMode === "url" ? (
              <UrlForm
                url={url}
                loading={loading}
                error={error}
                onChange={setUrl}
                onClear={() => {
                  setUrl("");
                  setError(null);
                }}
                onSubmit={() => extract()}
              />
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void extractCaption();
                }}
              >
                <textarea
                  value={captionText}
                  onChange={(event) => setCaptionText(event.target.value)}
                  placeholder={"Ingredients:\n1 cup flour\n...\n\nInstructions:\n1. Mix..."}
                  rows={8}
                  disabled={loading}
                  className="w-full resize-y rounded-2xl border-0 bg-ivory px-4 py-3 text-ink outline-none placeholder:text-olive/35"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={loading || !captionText}
                    onClick={() => {
                      setCaptionText("");
                      setError(null);
                    }}
                    className="rounded-full border-0 bg-transparent px-4 py-2 text-sm text-olive disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-full bg-terracotta px-5 py-2 text-sm text-ivory disabled:opacity-40"
                  >
                    {loading ? "Extracting…" : "Clip recipe"}
                  </button>
                </div>
                {error ? <p className="px-2 pb-2 text-sm text-terracotta">{error}</p> : null}
              </form>
            )}
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-olive/70">
            Reels often block a direct clip. If that happens, switch to Caption text and
            paste the ingredients and steps. On the phone app, recipes stay on the device.
          </p>
          <button
            type="button"
            className="mt-3 rounded-full border border-olive/20 bg-transparent px-4 py-2 text-sm text-olive"
            onClick={() => {
              setError(null);
              setRecipe(SAMPLE_RECIPE);
              setUrl(SAMPLE_RECIPE.sourceUrl);
              setCheckedIngredients(new Set());
              setDoneSteps(new Set());
              setCookIndex(0);
              setView("recipe");
            }}
          >
            Try a sample recipe
          </button>
          <div className="mt-4 flex max-w-md flex-wrap items-center gap-2">
            <input
              value={householdKey}
              onChange={(event) => {
                setHouseholdKey(event.target.value);
                setHouseholdSaved(false);
              }}
              placeholder="Household unlock code"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-[12rem] flex-1 rounded-full border border-olive/15 bg-ivory px-4 py-2 text-sm text-ink outline-none"
            />
            <button
              type="button"
              className="rounded-full border border-olive/20 bg-transparent px-4 py-2 text-sm text-olive"
              onClick={() => {
                const value = householdKey.trim();
                try {
                  if (value) localStorage.setItem(HOUSEHOLD_KEY_STORAGE, value);
                  else localStorage.removeItem(HOUSEHOLD_KEY_STORAGE);
                  setHouseholdKey(value);
                  setHouseholdSaved(true);
                } catch {
                  setError("Could not save the unlock code in this browser.");
                }
              }}
            >
              {householdSaved
                ? householdKey.trim()
                  ? "Unlimited clips on"
                  : "Unlock cleared"
                : "Save unlock"}
            </button>
          </div>
          <WeeklyMenu
            meals={weekly}
            recipes={savedRecipes}
            busy={libraryBusy}
            onAddCustom={(input) => void handleAddWeeklyCustom(input)}
            onAddRecipe={(recipe) => void handleAddWeeklyRecipe(recipe)}
            onRemove={(meal) => void handleRemoveWeekly(meal)}
            onToggle={(meal, checked) => void handleToggleWeekly(meal, checked)}
            onOpen={openSaved}
            onClear={() => void handleClearWeekly()}
          />
          <SavedLibrary
            recipes={savedRecipes}
            filter={libraryFilter}
            query={libraryQuery}
            weekRecipeIds={weekRecipeIds}
            onQuery={setLibraryQuery}
            onFilter={setLibraryFilter}
            onOpen={openSaved}
            onFavorite={(item) => void handleFavorite(item)}
            onWeek={(item) => void handleAddWeeklyRecipe(item)}
            onShop={(item) => void handleShopRecipe(item)}
            onDelete={(item) => void handleRemove(item)}
          />
        </main>
      )}

      {view === "recipe" && recipe && (
        <RecipeView
          recipe={recipe}
          scaledIngredients={scaledIngredients}
          metaBits={metaBits}
          servings={servings}
          onServings={setServings}
          checkedIngredients={checkedIngredients}
          doneSteps={doneSteps}
          onToggleIngredient={toggleIngredient}
          onToggleStep={toggleStep}
          onCook={openCook}
          onNew={() => {
            setView("home");
            setError(null);
          }}
          saved={savedMatch}
          busy={libraryBusy}
          error={error}
          editing={editing}
          draftTitle={draftTitle}
          draftYield={draftYield}
          draftIngredients={draftIngredients}
          draftSteps={draftSteps}
          draftNotes={draftNotes}
          draftTag={draftTag}
          onDraftTitle={setDraftTitle}
          onDraftYield={setDraftYield}
          onDraftIngredients={setDraftIngredients}
          onDraftSteps={setDraftSteps}
          onDraftNotes={setDraftNotes}
          onDraftTag={setDraftTag}
          onToggleEdit={() => setEditing((value) => !value)}
          onSaveEdit={() => void handleEditSave()}
          onSaveNotes={() => void persistPatch({ notes: draftNotes })}
          onAddTag={() => void addTag(draftTag)}
          onRemoveTag={(tag) => void removeTag(tag)}
          onToggleCategory={(category) =>
            void persistPatch({
              categories: toggleRecipeCategory(savedMatch?.categories, category),
            })
          }
          onSave={() => void handleSave()}
          onFavorite={() => void handleFavorite(savedMatch)}
          onRemove={() => {
            if (savedMatch) void handleRemove(savedMatch);
          }}
          onGrocery={() => void handleAddGrocery()}
          onWeekly={() => void handleWeeklyFromRecipe()}
          weeklyOn={Boolean(savedMatch && weekRecipeIds.has(savedMatch.id))}
          onShare={() => void shareRecipe()}
          onPrint={() => window.print()}
          onStartTimer={timers.startTimer}
        />
      )}

      {loading && (
        <LoadingScrim
          hint={
            isSocialUrl(url) ? EXTRACT_WAIT_HINT : "Reading the page and cutting the filler…"
          }
        />
      )}

      {cookOpen && recipe && (
        <CookMode
          recipe={recipe}
          ingredients={scaledIngredients}
          index={cookIndex}
          showIngredients={showCookIngredients}
          checkedIngredients={checkedIngredients}
          timers={timers.timers}
          onStartTimer={timers.startTimer}
          onCancelTimer={timers.cancelTimer}
          onToggleIngredient={toggleIngredient}
          onToggleIngredients={() => setShowCookIngredients((value) => !value)}
          onClose={() => setCookOpen(false)}
          onIndex={setCookIndex}
          onMarkDone={() => {
            toggleStep(cookIndex);
            if (cookIndex < recipe.steps.length - 1) {
              setCookIndex((index) => index + 1);
            } else {
              setCookOpen(false);
            }
          }}
        />
      )}

      {groceryOpen && (
        <GroceryPanel
          items={grocery}
          categoryOrder={categoryOrder}
          onClose={() => setGroceryOpen(false)}
          onToggle={async (item) => {
            const updated = await setGroceryItemChecked(item.id, !item.checked);
            setGrocery((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
          }}
          onCategory={async (item, category) => {
            const updated = await setGroceryItemCategory(item.id, category);
            setGrocery((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
          }}
          onMoveCategory={async (category, direction, visible) => {
            const next = moveCategoryOrder(categoryOrder, category, direction, visible);
            setCategoryOrder(await setGroceryCategoryOrder(next));
          }}
          onRemove={async (id) => {
            await removeGrocery(id);
            setGrocery((current) => current.filter((item) => item.id !== id));
          }}
          onCheckAll={async () => {
            const allChecked = grocery.length > 0 && grocery.every((item) => item.checked);
            setGrocery(await setAllGroceryChecked(!allChecked));
          }}
          onClear={async () => {
            setGrocery(await clearCheckedGrocery());
          }}
          onClearAll={async () => {
            setGrocery(await clearAllGrocery());
          }}
          onAdd={handleAddGroceryLine}
        />
      )}

      {removedRecipe ? (
        <div className="undo-toast" role="status">
          <span>Deleted “{removedRecipe.title}”.</span>
          <button type="button" onClick={() => void handleUndoRemove()}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}

function UrlForm({
  url,
  loading,
  error,
  onChange,
  onClear,
  onSubmit,
}: {
  url: string;
  loading: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="recipe-url">
        Recipe URL
      </label>
      <input
        id="recipe-url"
        value={url}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://example.com/your-favorite-recipe"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={loading}
        className="w-full rounded-2xl border-0 bg-ivory px-4 py-3 text-ink outline-none placeholder:text-olive/35"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={loading || !url}
          onClick={onClear}
          className="rounded-full border-0 bg-transparent px-4 py-2 text-sm text-olive disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-terracotta px-5 py-2 text-sm text-ivory disabled:opacity-40"
        >
          {loading ? "Extracting…" : "Clip recipe"}
        </button>
      </div>
      {error ? <p className="px-2 pb-2 text-sm text-terracotta">{error}</p> : null}
    </form>
  );
}

function RecipeView({
  recipe,
  scaledIngredients,
  metaBits,
  servings,
  onServings,
  checkedIngredients,
  doneSteps,
  onToggleIngredient,
  onToggleStep,
  onCook,
  onNew,
  saved,
  busy,
  error,
  editing,
  draftTitle,
  draftYield,
  draftIngredients,
  draftSteps,
  draftNotes,
  draftTag,
  onDraftTitle,
  onDraftYield,
  onDraftIngredients,
  onDraftSteps,
  onDraftNotes,
  onDraftTag,
  onToggleEdit,
  onSaveEdit,
  onSaveNotes,
  onAddTag,
  onRemoveTag,
  onToggleCategory,
  onSave,
  onFavorite,
  onRemove,
  onGrocery,
  onWeekly,
  weeklyOn,
  onShare,
  onPrint,
  onStartTimer,
}: {
  recipe: Recipe;
  scaledIngredients: string[];
  metaBits: string[];
  servings: number;
  onServings: (value: number) => void;
  checkedIngredients: Set<number>;
  doneSteps: Set<number>;
  onToggleIngredient: (index: number) => void;
  onToggleStep: (index: number) => void;
  onCook: (index: number) => void;
  onNew: () => void;
  saved: SavedRecipe | null;
  busy: boolean;
  error: string | null;
  editing: boolean;
  draftTitle: string;
  draftYield: string;
  draftIngredients: string;
  draftSteps: string;
  draftNotes: string;
  draftTag: string;
  onDraftTitle: (value: string) => void;
  onDraftYield: (value: string) => void;
  onDraftIngredients: (value: string) => void;
  onDraftSteps: (value: string) => void;
  onDraftNotes: (value: string) => void;
  onDraftTag: (value: string) => void;
  onToggleEdit: () => void;
  onSaveEdit: () => void;
  onSaveNotes: () => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onToggleCategory: (category: RecipeCategory) => void;
  onSave: () => void;
  onFavorite: () => void;
  onRemove: () => void;
  onGrocery: () => void;
  onWeekly: () => void;
  weeklyOn: boolean;
  onShare: () => void;
  onPrint: () => void;
  onStartTimer: (match: { seconds: number; label: string; start: number; end: number }) => void;
}) {
  const remaining = scaledIngredients.length - checkedIngredients.size;

  return (
    <main className="recipe">
      <section className="recipe-hero">
        {recipe.image && (
          <img
            className="recipe-image"
            src={recipe.image}
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <div className="recipe-intro">
          <p className="source">
            {recipe.sourceName ? (
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                {recipe.sourceName}
              </a>
            ) : (
              "Extracted recipe"
            )}
            {recipe.author ? ` · ${recipe.author}` : ""}
          </p>
          {editing ? (
            <input
              className="edit-title"
              value={draftTitle}
              onChange={(event) => onDraftTitle(event.target.value)}
            />
          ) : (
            <h1>{recipe.title}</h1>
          )}
          {recipe.description && !editing ? (
            <p className="description">{recipe.description}</p>
          ) : null}
          {metaBits.length > 0 && (
            <ul className="meta">
              {metaBits.map((bit) => (
                <li key={bit}>{bit}</li>
              ))}
            </ul>
          )}
          <div className="scale-bar">
            <span>Servings</span>
            <button className="ghost" onClick={() => onServings(Math.max(1, servings - 1))}>
              −
            </button>
            <strong>{servings}</strong>
            <button className="ghost" onClick={() => onServings(servings + 1)}>
              +
            </button>
            <button className="chip" onClick={() => onServings(Math.max(1, Math.round(servings / 2)))}>
              ½×
            </button>
            <button className="chip" onClick={() => onServings(servings * 2)}>
              2×
            </button>
          </div>
          <div className="actions">
            <button className="primary" onClick={() => onCook(0)}>
              Start cooking
            </button>
            <button className="ghost" onClick={onSave} disabled={busy || Boolean(saved)}>
              {saved ? "Saved" : busy ? "Saving…" : "Save recipe"}
            </button>
            <button
              className={`ghost star-btn ${saved?.favorite ? "is-on" : ""}`}
              onClick={onFavorite}
              disabled={busy}
            >
              {saved?.favorite ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button className="ghost" onClick={onGrocery} disabled={busy}>
              Add to grocery
            </button>
            <button className="ghost" onClick={onWeekly} disabled={busy}>
              {weeklyOn ? "On this week" : "Add to this week"}
            </button>
            <button className="ghost" onClick={onShare}>
              Share
            </button>
            <button className="ghost" onClick={onPrint}>
              Print / PDF
            </button>
            <button className="ghost" onClick={onToggleEdit}>
              {editing ? "Cancel edit" : "Edit"}
            </button>
            {saved ? (
              <button className="ghost" onClick={onRemove} disabled={busy}>
                Delete recipe
              </button>
            ) : null}
            <button className="ghost" onClick={onNew}>
              New URL
            </button>
          </div>
          {error ? <p className="form-error recipe-error">{error}</p> : null}
        </div>
      </section>

      <div className="recipe-grid">
        <aside className="ingredients">
          <div className="panel-head">
            <h2>Ingredients</h2>
            <span>
              {remaining} left / {scaledIngredients.length}
            </span>
          </div>
          {editing ? (
            <textarea
              className="edit-area"
              value={draftIngredients}
              onChange={(event) => onDraftIngredients(event.target.value)}
              rows={10}
            />
          ) : scaledIngredients.length === 0 ? (
            <p className="empty">No ingredients were found on that page.</p>
          ) : (
            <ul>
              {scaledIngredients.map((ingredient, index) => (
                <li key={`${index}-${ingredient}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checkedIngredients.has(index)}
                      onChange={() => onToggleIngredient(index)}
                    />
                    <span>{ingredient}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="steps">
          <div className="panel-head">
            <h2>Steps</h2>
            <span>
              {doneSteps.size} done / {recipe.steps.length}
            </span>
          </div>
          {editing ? (
            <>
              <label className="edit-label">
                Yield
                <input
                  value={draftYield}
                  onChange={(event) => onDraftYield(event.target.value)}
                />
              </label>
              <textarea
                className="edit-area"
                value={draftSteps}
                onChange={(event) => onDraftSteps(event.target.value)}
                rows={12}
              />
              <button className="primary" onClick={onSaveEdit} disabled={busy}>
                Save edits
              </button>
            </>
          ) : recipe.steps.length === 0 ? (
            <p className="empty">No instructions were found on that page.</p>
          ) : (
            <ol>
              {recipe.steps.map((step, index) => {
                const done = doneSteps.has(index);
                return (
                  <li
                    key={`${index}-${step.slice(0, 24)}`}
                    className={`step-card ${done ? "is-done" : ""}`}
                  >
                    <button
                      className="step-index"
                      onClick={() => onCook(index)}
                      title="Open this step in cook mode"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </button>
                    <div className="step-body">
                      <StepWithTimers text={step} onStart={onStartTimer} />
                      <div className="step-tools">
                        <button className="text-btn" onClick={() => onCook(index)}>
                          Focus
                        </button>
                        <button className="text-btn" onClick={() => onToggleStep(index)}>
                          {done ? "Undo" : "Mark done"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="notes-panel">
        <div className="panel-head">
          <h2>Meal</h2>
        </div>
        <div className="tag-row">
          {RECIPE_CATEGORIES.map((category) => {
            const on = (saved?.categories ?? []).includes(category);
            return (
              <button
                key={category}
                className={`chip ${on ? "is-on" : ""}`}
                onClick={() => onToggleCategory(category)}
                disabled={busy}
              >
                {recipeCategoryLabel(category)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="notes-panel">
        <div className="panel-head">
          <h2>Notes & tags</h2>
        </div>
        <div className="tag-row">
          {(saved?.tags ?? []).map((tag) => (
            <button key={tag} className="chip is-on" onClick={() => onRemoveTag(tag)}>
              {tag} ×
            </button>
          ))}
          <input
            value={draftTag}
            onChange={(event) => onDraftTag(event.target.value)}
            placeholder="Add tag"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddTag();
              }
            }}
          />
        </div>
        <textarea
          className="edit-area"
          value={draftNotes}
          onChange={(event) => onDraftNotes(event.target.value)}
          placeholder="Cook’s note — more lemon, used brown butter, etc."
          rows={4}
        />
        <button className="ghost" onClick={onSaveNotes} disabled={busy}>
          Save notes
        </button>
      </section>
    </main>
  );
}

function CookMode({
  recipe,
  ingredients,
  index,
  showIngredients,
  checkedIngredients,
  timers,
  onStartTimer,
  onCancelTimer,
  onToggleIngredient,
  onToggleIngredients,
  onClose,
  onIndex,
  onMarkDone,
}: {
  recipe: Recipe;
  ingredients: string[];
  index: number;
  showIngredients: boolean;
  checkedIngredients: Set<number>;
  timers: { id: string; label: string; display: string }[];
  onStartTimer: (match: { seconds: number; label: string; start: number; end: number }) => void;
  onCancelTimer: (id: string) => void;
  onToggleIngredient: (index: number) => void;
  onToggleIngredients: () => void;
  onClose: () => void;
  onIndex: (index: number) => void;
  onMarkDone: () => void;
}) {
  const total = recipe.steps.length;
  const step = recipe.steps[index] ?? "";
  const atStart = index <= 0;
  const atEnd = index >= total - 1;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === "l" || event.key === " ") {
        event.preventDefault();
        if (!atEnd) onIndex(index + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "h") {
        event.preventDefault();
        if (!atStart) onIndex(index - 1);
      }
      if (event.key === "i") onToggleIngredients();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [atEnd, atStart, index, onClose, onIndex, onToggleIngredients]);

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label="Cook mode">
      <div className="cook-bar">
        <p>
          Step {index + 1} of {total}
        </p>
        <div className="cook-bar-actions">
          <button onClick={onToggleIngredients}>
            {showIngredients ? "Hide ingredients" : "Ingredients"}
          </button>
          <button onClick={onClose}>Exit</button>
        </div>
      </div>
      <div
        className="cook-progress"
        style={{ width: `${total ? ((index + 1) / total) * 100 : 0}%` }}
      />
      {timers.length > 0 && (
        <div className="timer-bar">
          {timers.map((timer) => (
            <button key={timer.id} onClick={() => onCancelTimer(timer.id)}>
              {timer.display} {timer.label}
            </button>
          ))}
        </div>
      )}
      <div className="cook-stage">
        <p className="cook-kicker">{recipe.title}</p>
        <StepWithTimers className="cook-step" text={step} onStart={onStartTimer} />
      </div>
      <div className="cook-nav">
        <button disabled={atStart} onClick={() => onIndex(index - 1)}>
          Previous
        </button>
        <button className="primary" onClick={onMarkDone}>
          {atEnd ? "Done" : "Next step"}
        </button>
      </div>
      {showIngredients && (
        <aside className="cook-ingredients">
          <h2>Ingredients</h2>
          <ul>
            {ingredients.map((ingredient, ingredientIndex) => (
              <li key={`${ingredientIndex}-${ingredient}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={checkedIngredients.has(ingredientIndex)}
                    onChange={() => onToggleIngredient(ingredientIndex)}
                  />
                  <span>{ingredient}</span>
                </label>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

function GroceryPanel({
  items,
  categoryOrder,
  onClose,
  onToggle,
  onCategory,
  onMoveCategory,
  onRemove,
  onCheckAll,
  onClear,
  onClearAll,
  onAdd,
}: {
  items: GroceryItem[];
  categoryOrder: GroceryCategory[];
  onClose: () => void;
  onToggle: (item: GroceryItem) => void;
  onCategory: (item: GroceryItem, category: GroceryCategory) => void;
  onMoveCategory: (
    category: GroceryCategory,
    direction: -1 | 1,
    visible?: GroceryCategory[],
  ) => void;
  onRemove: (id: string) => void;
  onCheckAll: () => void;
  onClear: () => void;
  onClearAll: () => void;
  onAdd: (line: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");
  const groups = groupGroceryItems(items, categoryOrder);
  const visible = groups.map((group) => group.category);
  const allChecked = items.length > 0 && items.every((item) => item.checked);
  return (
    <div className="grocery" role="dialog" aria-label="Grocery list">
      <div className="grocery-card">
        <div className="panel-head">
          <h2>Grocery list</h2>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <form
          className="grocery-add"
          onSubmit={(event) => {
            event.preventDefault();
            const line = draft.trim();
            if (!line) return;
            void Promise.resolve(onAdd(line)).then(() => setDraft(""));
          }}
        >
          <label className="sr-only" htmlFor="grocery-item">
            Add a grocery item
          </label>
          <input
            id="grocery-item"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Milk, 2 limes, olive oil…"
          />
          <button type="submit" className="ghost" disabled={!draft.trim()}>
            Add
          </button>
        </form>
        <details className="grocery-arrange">
          <summary>Arrange aisles</summary>
          <ol>
            {categoryOrder.map((category, index) => (
              <li key={category}>
                <span>{groceryCategoryLabel(category)}</span>
                <span className="grocery-move">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveCategory(category, -1, categoryOrder)}
                    aria-label={`Move ${groceryCategoryLabel(category)} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === categoryOrder.length - 1}
                    onClick={() => onMoveCategory(category, 1, categoryOrder)}
                    aria-label={`Move ${groceryCategoryLabel(category)} down`}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </details>
        {items.length === 0 ? (
          <p className="library-empty">
            Add items above, or open a recipe and tap Add to grocery.
          </p>
        ) : (
          <div className="grocery-list">
            <p className="grocery-hint">
              Pick an aisle for each item. Use the arrows to reorder aisles.
            </p>
            {groups.map((group) => (
              <section key={group.category} className="grocery-group">
                <div className="grocery-group-head">
                  <h3 className="grocery-group-title">{group.label}</h3>
                  <span className="grocery-move">
                    <button
                      type="button"
                      disabled={visible[0] === group.category}
                      onClick={() => onMoveCategory(group.category, -1, visible)}
                      aria-label={`Move ${group.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={visible[visible.length - 1] === group.category}
                      onClick={() => onMoveCategory(group.category, 1, visible)}
                      aria-label={`Move ${group.label} down`}
                    >
                      ↓
                    </button>
                  </span>
                </div>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id} className={item.checked ? "is-done" : ""}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => onToggle(item)}
                        />
                        <span>
                          {item.label}
                          {item.recipeTitles.length ? (
                            <em> · {item.recipeTitles.join(", ")}</em>
                          ) : null}
                        </span>
                      </label>
                      <div className="grocery-item-actions">
                        <label className="grocery-cat-label">
                          <span className="visually-hidden">Move {item.label} to aisle</span>
                          <select
                            className="grocery-cat"
                            value={itemGroceryCategory(item)}
                            onChange={(event) =>
                              onCategory(item, event.target.value as GroceryCategory)
                            }
                          >
                            {categoryOrder.map((category) => (
                              <option key={category} value={category}>
                                {groceryCategoryLabel(category)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="text-btn" onClick={() => onRemove(item.id)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="grocery-toolbar">
          <button className="ghost" disabled={!items.length} onClick={onCheckAll}>
            {allChecked ? "Uncheck all" : "Check all"}
          </button>
          <button className="ghost" disabled={!items.some((item) => item.checked)} onClick={onClear}>
            Clear checked
          </button>
          <button className="ghost" disabled={!items.length} onClick={onClearAll}>
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingScrim({ hint }: { hint: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-card">
        <span className="pulse" />
        <p>{hint}</p>
      </div>
    </div>
  );
}
