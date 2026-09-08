import { useState } from "react";
import { parseShopLines, sortWeeklyMeals } from "../shared/weekly";
import type { SavedRecipe, WeeklyMeal } from "./types";

export function WeeklyMenu({
  meals,
  recipes,
  busy,
  onAddCustom,
  onAddRecipe,
  onRemove,
  onToggle,
  onOpen,
  onClear,
}: {
  meals: WeeklyMeal[];
  recipes: SavedRecipe[];
  busy: boolean;
  onAddCustom: (input: { title: string; ingredients: string[] }) => void;
  onAddRecipe: (recipe: SavedRecipe) => void;
  onRemove: (meal: WeeklyMeal) => void;
  onToggle: (meal: WeeklyMeal, checked: boolean) => void;
  onOpen: (recipe: SavedRecipe) => void;
  onClear: () => void;
}) {
  const [title, setTitle] = useState("");
  const [shop, setShop] = useState("");
  const [pickId, setPickId] = useState("");
  const recipeById = new Map(recipes.map((item) => [item.id, item]));
  const listed = sortWeeklyMeals(meals);

  function submitCustom() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddCustom({
      title: trimmed,
      ingredients: parseShopLines(shop),
    });
    setTitle("");
    setShop("");
  }

  function submitRecipe() {
    const recipe = recipes.find((item) => item.id === pickId);
    if (!recipe) return;
    onAddRecipe(recipe);
    setPickId("");
  }

  return (
    <section id="this-week" className="mt-16 rounded-[2rem] border border-olive/15 bg-oatmeal px-5 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-medium tracking-[0.22em] uppercase text-terracotta">
            Plan the week
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-tight text-espresso">Weekly meals</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-olive/75">
            Add clipped recipes or easy meals that don’t need a recipe. Anything you add
            goes on the grocery list.
          </p>
        </div>
        {meals.length ? (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="rounded-full border-0 bg-transparent px-3 py-2 text-[0.72rem] tracking-[0.14em] uppercase text-terracotta disabled:opacity-40"
          >
            Clear week
          </button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 rounded-3xl border border-olive/10 bg-ivory p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[0.68rem] tracking-[0.16em] uppercase text-olive/70">
            Easy meal
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-olive/15 bg-oatmeal px-3 py-2.5 text-sm text-ink outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitCustom();
              }
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.68rem] tracking-[0.16em] uppercase text-olive/70">
            Need from the store
          </span>
          <input
            value={shop}
            onChange={(event) => setShop(event.target.value)}
            className="w-full rounded-2xl border border-olive/15 bg-oatmeal px-3 py-2.5 text-sm text-ink outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={submitCustom}
          className="rounded-full bg-olive px-5 py-2.5 text-sm text-ivory disabled:opacity-40"
        >
          Add meal
        </button>
      </div>

      {recipes.length ? (
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className="mb-1.5 block text-[0.68rem] tracking-[0.16em] uppercase text-olive/70">
              From the collection
            </span>
            <select
              value={pickId}
              onChange={(event) => setPickId(event.target.value)}
              className="w-full rounded-2xl border border-olive/15 bg-ivory px-3 py-2.5 text-sm text-ink outline-none"
            >
              <option value="">Choose a saved recipe</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !pickId}
            onClick={submitRecipe}
            className="rounded-full border border-olive/20 bg-ivory px-5 py-2.5 text-sm text-olive disabled:opacity-40"
          >
            Add recipe
          </button>
        </div>
      ) : null}

      {listed.length === 0 ? (
        <p className="font-display text-xl italic text-olive/65">
          Nothing planned yet. Add grilled cheese, leftover night, or a clipped recipe.
        </p>
      ) : (
        <ul className="space-y-2">
          {listed.map((meal) => {
            const linked = meal.recipeId ? recipeById.get(meal.recipeId) : undefined;
            return (
              <li
                key={meal.id}
                className="flex items-center gap-3 rounded-2xl border border-olive/10 bg-ivory px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={meal.checked}
                  onChange={(event) => onToggle(meal, event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-olive"
                  aria-label={`Mark ${meal.title} done`}
                />
                <div className="min-w-0 flex-1">
                  {linked ? (
                    <button
                      type="button"
                      onClick={() => onOpen(linked)}
                      className={`border-0 bg-transparent p-0 text-left font-display text-xl ${
                        meal.checked ? "text-olive/50 line-through" : "text-espresso"
                      }`}
                    >
                      {meal.title}
                    </button>
                  ) : (
                    <p
                      className={`font-display text-xl ${
                        meal.checked ? "text-olive/50 line-through" : "text-espresso"
                      }`}
                    >
                      {meal.title}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(meal)}
                  disabled={busy}
                  className="shrink-0 rounded-full border-0 bg-transparent px-2 py-1 text-xs uppercase tracking-wide text-terracotta"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
