import { useState } from "react";
import { WEEKDAYS, groupWeeklyMeals, parseShopLines, sortWeeklyMeals, weekdayLabel } from "../shared/weekly";
import type { SavedRecipe, Weekday, WeeklyMeal } from "./types";

export function WeeklyMenu({
  meals,
  recipes,
  busy,
  onAddCustom,
  onAddRecipe,
  onRemove,
  onToggle,
  onSetDay,
  assignWeekdays,
  onAssignWeekdays,
  onOpen,
  onClear,
}: {
  meals: WeeklyMeal[];
  recipes: SavedRecipe[];
  busy: boolean;
  onAddCustom: (input: { title: string; ingredients: string[]; weekday?: Weekday | null }) => void;
  onAddRecipe: (recipe: SavedRecipe) => void;
  onRemove: (meal: WeeklyMeal) => void;
  onToggle: (meal: WeeklyMeal, checked: boolean) => void;
  onSetDay: (meal: WeeklyMeal, weekday: Weekday | null) => void;
  assignWeekdays: boolean;
  onAssignWeekdays: (next: boolean) => void;
  onOpen: (recipe: SavedRecipe) => void;
  onClear: () => void;
}) {
  const [title, setTitle] = useState("");
  const [shop, setShop] = useState("");
  const [pickId, setPickId] = useState("");
  const [newDay, setNewDay] = useState<Weekday | null>(null);
  const recipeById = new Map(recipes.map((item) => [item.id, item]));
  const groups = assignWeekdays
    ? groupWeeklyMeals(meals)
    : [{ key: "all", label: "", meals: sortWeeklyMeals(meals) }];

  function submitCustom() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddCustom({
      title: trimmed,
      ingredients: parseShopLines(shop),
      weekday: assignWeekdays ? newDay : null,
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
          <label className="mt-4 flex items-center gap-3 text-sm text-olive">
            <input
              type="checkbox"
              checked={assignWeekdays}
              onChange={(event) => onAssignWeekdays(event.target.checked)}
              className="h-4 w-4 accent-olive"
            />
            Assign days — pick a weekday when you add a meal
          </label>
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
      {assignWeekdays ? (
      <div className="mb-6 flex flex-wrap gap-2">
        <DayChip label="Anytime" on={newDay === null} onClick={() => setNewDay(null)} />
        {WEEKDAYS.map((day) => (
          <DayChip
            key={day}
            label={weekdayLabel(day)}
            on={newDay === day}
            onClick={() => setNewDay(day)}
          />
        ))}
      </div>
      ) : null}

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

      {meals.length === 0 ? (
        <p className="font-display text-xl italic text-olive/65">
          Nothing planned yet. Add grilled cheese, leftover night, or a clipped recipe.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              {group.label ? (
              <h3 className="mb-2 text-[0.72rem] font-medium tracking-[0.16em] uppercase text-olive/70">
                {group.label}
              </h3>
              ) : null}
              <ul className="space-y-2">
                {group.meals.map((meal) => {
                  const linked = meal.recipeId ? recipeById.get(meal.recipeId) : undefined;
                  return (
                    <li
                      key={meal.id}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-olive/10 bg-ivory px-4 py-3"
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
                        {assignWeekdays ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <DayChip
                            label="Any"
                            on={meal.weekday == null}
                            onClick={() => onSetDay(meal, null)}
                            compact
                          />
                          {WEEKDAYS.map((day) => (
                            <DayChip
                              key={day}
                              label={weekdayLabel(day)}
                              on={meal.weekday === day}
                              onClick={() => onSetDay(meal, day)}
                              compact
                            />
                          ))}
                        </div>
                        ) : null}
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DayChip({
  label,
  on,
  onClick,
  compact,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border ${
        compact ? "px-2 py-0.5 text-[0.65rem]" : "px-3 py-1 text-[0.72rem]"
      } tracking-[0.08em] uppercase ${
        on ? "border-olive/40 bg-olive text-ivory" : "border-olive/20 bg-ivory text-olive"
      }`}
    >
      {label}
    </button>
  );
}
