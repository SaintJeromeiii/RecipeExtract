import { useEffect, useMemo, useState } from "react";
import {
  groceryCategoryLabel,
  groupGroceryItems,
  nextGroceryCategory,
} from "../shared/groceryCategories";
import { matchesQuery, parseServings, scaleIngredientLine } from "../shared/ingredients";
import { recipeAsText } from "../shared/share-text";
import { StepWithTimers, useCookTimers, useWakeLock } from "./kitchen";
import {
  addGrocery,
  clearCheckedGrocery,
  listGrocery,
  listSavedRecipes,
  removeGrocery,
  removeSavedRecipe,
  saveRecipe,
  setGroceryItemCategory,
  setGroceryItemChecked,
  setRecipeFavorite,
  updateSavedRecipe,
} from "./library";
import type { GroceryItem, Recipe, SavedRecipe } from "./types";

const EXAMPLES = [
  {
    label: "Lentil soup",
    url: "https://cookieandkate.com/best-lentil-soup-recipe/",
  },
  {
    label: "Banana bread",
    url: "https://www.loveandlemons.com/banana-bread/",
  },
  {
    label: "Vegan paella",
    url: "https://minimalistbaker.com/easy-vegan-paella/",
  },
];

type View = "home" | "recipe";

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
  const [libraryFilter, setLibraryFilter] = useState<"all" | "favorites">("all");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
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
    void listSavedRecipes().then(setSavedRecipes).catch(() => {});
    void listGrocery().then(setGrocery).catch(() => {});
  }, []);

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
    setUrl(trimmed);
    setLoading(true);
    setError(null);
    setCookOpen(false);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
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
        headers: { "Content-Type": "application/json" },
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
    setLibraryBusy(true);
    setError(null);
    try {
      await removeSavedRecipe(saved.id);
      setSavedRecipes((current) => current.filter((item) => item.id !== saved.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that recipe.");
    } finally {
      setLibraryBusy(false);
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

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setView("home");
            setCookOpen(false);
            setError(null);
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          RecipeGuru
        </button>
        <div className="topbar-actions">
          <button className="ghost" onClick={() => setGroceryOpen(true)}>
            Grocery {grocery.filter((item) => !item.checked).length}
          </button>
          {view === "recipe" && recipe ? (
            <button className="ghost" onClick={() => openCook(0)}>
              Cook mode
            </button>
          ) : null}
        </div>
      </header>

      {view === "home" && (
        <main className="hero">
          <p className="eyebrow">Skip the blog. Keep the recipe.</p>
          <h1>
            Paste a URL.
            <em> Cook the actual recipe.</em>
          </h1>
          <p className="lede">
            Paste a recipe-blog URL, a Facebook / TikTok / Instagram Reel link,
            or the caption text itself — we pull out ingredients and steps.
          </p>
          <div className="composer">
            <div className="mode-switch" role="tablist" aria-label="Paste type">
              <button
                type="button"
                className={`mode-switch-btn${inputMode === "url" ? " is-on" : ""}`}
                onClick={() => setInputMode("url")}
              >
                URL
              </button>
              <button
                type="button"
                className={`mode-switch-btn${inputMode === "caption" ? " is-on" : ""}`}
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
              className="url-form"
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
              />
              <div className="url-form-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={loading || !captionText}
                  onClick={() => {
                    setCaptionText("");
                    setError(null);
                  }}
                >
                  Clear
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? "Extracting…" : "Extract"}
                </button>
              </div>
              {error && <p className="form-error">{error}</p>}
            </form>
          )}
          </div>
          <div className="examples">
            <span>Try one</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.url}
                className="chip"
                disabled={loading}
                onClick={() => {
                  setInputMode("url");
                  setUrl(example.url);
                  void extract(example.url);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>
          <SavedLibrary
            recipes={savedRecipes}
            filter={libraryFilter}
            query={libraryQuery}
            onQuery={setLibraryQuery}
            onFilter={setLibraryFilter}
            onOpen={openSaved}
            onFavorite={(item) => void handleFavorite(item)}
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
          onSave={() => void handleSave()}
          onFavorite={() => void handleFavorite(savedMatch)}
          onRemove={() => {
            if (savedMatch) void handleRemove(savedMatch);
          }}
          onGrocery={() => void handleAddGrocery()}
          onShare={() => void shareRecipe()}
          onPrint={() => window.print()}
          onStartTimer={timers.startTimer}
        />
      )}

      {loading && <LoadingScrim />}

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
          onClose={() => setGroceryOpen(false)}
          onToggle={async (item) => {
            const updated = await setGroceryItemChecked(item.id, !item.checked);
            setGrocery((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
          }}
          onCategory={async (item) => {
            const updated = await setGroceryItemCategory(
              item.id,
              nextGroceryCategory(item.category),
            );
            setGrocery((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
          }}
          onRemove={async (id) => {
            await removeGrocery(id);
            setGrocery((current) => current.filter((item) => item.id !== id));
          }}
          onClear={async () => {
            setGrocery(await clearCheckedGrocery());
          }}
        />
      )}
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
      className="url-form"
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
      />
      <div className="url-form-actions">
        <button
          type="button"
          className="ghost"
          disabled={loading || !url}
          onClick={onClear}
        >
          Clear
        </button>
        <button type="submit" disabled={loading}>
          {loading ? "Extracting…" : "Extract"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
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
  onSave,
  onFavorite,
  onRemove,
  onGrocery,
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
  onSave: () => void;
  onFavorite: () => void;
  onRemove: () => void;
  onGrocery: () => void;
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
                Remove
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

function SavedLibrary({
  recipes,
  filter,
  query,
  onQuery,
  onFilter,
  onOpen,
  onFavorite,
}: {
  recipes: SavedRecipe[];
  filter: "all" | "favorites";
  query: string;
  onQuery: (value: string) => void;
  onFilter: (filter: "all" | "favorites") => void;
  onOpen: (recipe: SavedRecipe) => void;
  onFavorite: (recipe: SavedRecipe) => void;
}) {
  const visible = recipes.filter((item) => {
    if (filter === "favorites" && !item.favorite) return false;
    return matchesQuery(item, query);
  });

  return (
    <section className="library">
      <div className="library-head">
        <h2>Saved recipes</h2>
        <div className="library-filters">
          <button
            className={`chip ${filter === "all" ? "is-on" : ""}`}
            onClick={() => onFilter("all")}
          >
            All {recipes.length}
          </button>
          <button
            className={`chip ${filter === "favorites" ? "is-on" : ""}`}
            onClick={() => onFilter("favorites")}
          >
            Favorites {recipes.filter((item) => item.favorite).length}
          </button>
        </div>
      </div>
      <input
        className="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search title, ingredient, tag, or note"
      />
      {recipes.length === 0 ? (
        <p className="library-empty">
          Extract a recipe, then tap Save. Favorites live here too.
        </p>
      ) : visible.length === 0 ? (
        <p className="library-empty">No recipes match that search.</p>
      ) : (
        <ul className="library-grid">
          {visible.map((item) => (
            <li key={item.id}>
              <article className="library-card">
                <button className="library-open" onClick={() => onOpen(item)}>
                  {item.image ? (
                    <img src={item.image} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="library-placeholder">R</span>
                  )}
                  <span>
                    <strong>{item.title}</strong>
                    <em>
                      {item.sourceName ?? "Saved recipe"}
                      {item.favorite ? " · Favorite" : ""}
                      {item.tags.length ? ` · ${item.tags.join(", ")}` : ""}
                    </em>
                  </span>
                </button>
                <button
                  className={`star-btn ${item.favorite ? "is-on" : ""}`}
                  onClick={() => onFavorite(item)}
                  title={item.favorite ? "Remove favorite" : "Favorite"}
                >
                  {item.favorite ? "★" : "☆"}
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GroceryPanel({
  items,
  onClose,
  onToggle,
  onCategory,
  onRemove,
  onClear,
}: {
  items: GroceryItem[];
  onClose: () => void;
  onToggle: (item: GroceryItem) => void;
  onCategory: (item: GroceryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const groups = groupGroceryItems(items);
  return (
    <div className="grocery" role="dialog" aria-label="Grocery list">
      <div className="grocery-card">
        <div className="panel-head">
          <h2>Grocery list</h2>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {items.length === 0 ? (
          <p className="library-empty">
            Open a recipe and tap Add to grocery for unchecked ingredients.
          </p>
        ) : (
          <div className="grocery-list">
            <p className="grocery-hint">Sorted by aisle. Tap a category to change it.</p>
            {groups.map((group) => (
              <section key={group.category} className="grocery-group">
                <h3 className="grocery-group-title">{group.label}</h3>
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
                        <button
                          type="button"
                          className="grocery-cat"
                          onClick={() => onCategory(item)}
                          title="Change category"
                        >
                          {groceryCategoryLabel(item.category)}
                        </button>
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
        <button className="ghost" onClick={onClear}>
          Clear checked
        </button>
      </div>
    </div>
  );
}

function LoadingScrim() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-card">
        <span className="pulse" />
        <p>Reading the page and cutting the filler…</p>
      </div>
    </div>
  );
}
