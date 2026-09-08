import { useState } from "react";
import {
  RECIPE_CATEGORIES,
  recipeCategoryLabel,
  recipeMatchesCategory,
} from "../shared/recipeCategories";
import { matchesQuery } from "../shared/ingredients";
import type { RecipeCategory, SavedRecipe } from "./types";

type LibraryFilter = "all" | "favorites" | RecipeCategory;
type PlateVariant = "tall" | "wide" | "text" | "inset";

const PLATE_VARIANTS: PlateVariant[] = ["tall", "inset", "wide", "text"];

function sourceLabel(recipe: SavedRecipe): string {
  if (recipe.sourceName?.trim()) return recipe.sourceName.trim();
  try {
    return new URL(recipe.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Clipped recipe";
  }
}

function clippedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecipeImage({
  src,
  title,
  className,
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`flex items-end bg-linear-to-br from-oatmeal via-sage/80 to-[#d8cbb8] p-6 ${className ?? ""}`}
      >
        <span className="font-display text-6xl italic leading-none text-terracotta/35">
          {title.trim().charAt(0) || "R"}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}

function KeepMark({
  kept,
  onToggle,
}: {
  kept: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`rounded-full border px-3 py-1 text-[0.68rem] font-medium tracking-[0.16em] uppercase ${
        kept
          ? "border-terracotta/50 bg-terracotta text-ivory"
          : "border-olive/20 bg-ivory/80 text-olive"
      }`}
    >
      {kept ? "Kept" : "Keep"}
    </button>
  );
}

function PlateTools({
  kept,
  onWeek,
  planned,
  onFavorite,
  onShop,
  onDelete,
}: {
  kept: boolean;
  planned: boolean;
  onFavorite: () => void;
  onWeek: () => void;
  onShop: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <KeepMark kept={kept} onToggle={onFavorite} />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onWeek();
        }}
        className={`rounded-full border px-3 py-1 text-[0.68rem] font-medium tracking-[0.16em] uppercase ${
          planned
            ? "border-olive/40 bg-olive text-ivory"
            : "border-olive/20 bg-ivory/80 text-olive"
        }`}
      >
        {planned ? "On week" : "Week"}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onShop();
        }}
        className="rounded-full border border-olive/20 bg-ivory/80 px-3 py-1 text-[0.68rem] font-medium tracking-[0.16em] uppercase text-olive"
      >
        Shop
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="rounded-full border-0 bg-transparent px-3 py-1 text-[0.68rem] font-medium tracking-[0.16em] uppercase text-terracotta"
      >
        Delete
      </button>
    </div>
  );
}

function RecipePlate({
  recipe,
  variant,
  onOpen,
  onFavorite,
  onWeek,
  onShop,
  onDelete,
  planned,
}: {
  recipe: SavedRecipe;
  variant: PlateVariant;
  planned: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onWeek: () => void;
  onShop: () => void;
  onDelete: () => void;
}) {
  const source = sourceLabel(recipe);
  const meal = recipe.categories?.[0];

  if (variant === "text") {
    return (
      <article className="mb-7 break-inside-avoid rounded-3xl border border-olive/12 bg-oatmeal px-6 pb-6 pt-5">
        <div className="mb-8 flex items-start justify-between gap-3">
          {recipe.image ? (
            <RecipeImage
              src={recipe.image}
              title={recipe.title}
              className="h-16 w-16 rounded-2xl"
            />
          ) : (
            <span className="font-display text-4xl italic text-terracotta/40">
              {recipe.title.charAt(0)}
            </span>
          )}
        </div>
        <button type="button" onClick={onOpen} className="block w-full border-0 bg-transparent p-0 text-left">
          <h3 className="font-display text-[1.85rem] leading-[1.05] text-espresso">
            {recipe.title}
          </h3>
          <p className="mt-3 text-sm tracking-wide text-olive/70">
            {source}
            {meal ? ` · ${recipeCategoryLabel(meal)}` : ""}
          </p>
        </button>
        <div className="mt-5">
          <PlateTools
            kept={recipe.favorite}
            planned={planned}
            onFavorite={onFavorite}
            onWeek={onWeek}
            onShop={onShop}
            onDelete={onDelete}
          />
        </div>
      </article>
    );
  }

  const imageClass =
    variant === "tall"
      ? "aspect-[3/4] w-full rounded-3xl"
      : variant === "wide"
        ? "aspect-[16/10] w-full rounded-3xl"
        : "aspect-[4/5] w-full rounded-3xl";

  return (
    <article className="mb-7 break-inside-avoid">
      <button type="button" onClick={onOpen} className="block w-full border-0 bg-transparent p-0 text-left">
        <div className={variant === "inset" ? "relative" : "relative overflow-visible"}>
          <RecipeImage src={recipe.image} title={recipe.title} className={imageClass} />
          {variant === "inset" ? (
            <div className="absolute bottom-5 left-4 right-10 translate-x-2 rounded-3xl border border-olive/10 bg-ivory/92 px-5 py-4">
              <h3 className="font-display text-[1.45rem] leading-tight text-espresso">
                {recipe.title}
              </h3>
            </div>
          ) : null}
        </div>
        {variant !== "inset" ? (
          <div className={variant === "wide" ? "relative z-10 ml-5 -mt-7 max-w-[90%] rounded-3xl border border-olive/10 bg-ivory px-5 py-4" : "mt-4 pl-5"}>
            <h3
              className={`font-display leading-tight text-espresso ${
                variant === "tall" ? "text-[1.7rem]" : "text-[1.5rem]"
              }`}
            >
              {recipe.title}
            </h3>
            <p className="mt-2 text-sm text-olive/70">{source}</p>
          </div>
        ) : (
          <p className="mt-10 pl-5 text-sm text-olive/70">{source}</p>
        )}
      </button>
      <div className="mt-3 flex items-center justify-between gap-3 pl-5 pr-1">
        <p className="text-[0.68rem] tracking-[0.16em] uppercase text-terracotta/80">
          {meal ? recipeCategoryLabel(meal) : clippedOn(recipe.savedAt)}
        </p>
        <PlateTools
          kept={recipe.favorite}
          planned={planned}
          onFavorite={onFavorite}
          onWeek={onWeek}
          onShop={onShop}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}

export function SavedLibrary({
  recipes,
  filter,
  query,
  onQuery,
  onFilter,
  onOpen,
  onFavorite,
  onWeek,
  onShop,
  onDelete,
  weekRecipeIds,
}: {
  recipes: SavedRecipe[];
  filter: LibraryFilter;
  query: string;
  weekRecipeIds: Set<string>;
  onQuery: (value: string) => void;
  onFilter: (filter: LibraryFilter) => void;
  onOpen: (recipe: SavedRecipe) => void;
  onFavorite: (recipe: SavedRecipe) => void;
  onWeek: (recipe: SavedRecipe) => void;
  onShop: (recipe: SavedRecipe) => void;
  onDelete: (recipe: SavedRecipe) => void;
}) {
  const visible = recipes.filter((item) => {
    if (filter === "favorites" && !item.favorite) return false;
    if (filter !== "all" && filter !== "favorites" && !recipeMatchesCategory(item, filter)) {
      return false;
    }
    return matchesQuery(item, query);
  });
  const [lead, ...rest] = visible;
  const mealFilters = RECIPE_CATEGORIES.filter((category) =>
    recipes.some((item) => recipeMatchesCategory(item, category)),
  );

  return (
    <section className="mt-20 border-t border-olive/15 pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[0.7rem] font-medium tracking-[0.22em] uppercase text-terracotta">
            From the shelf
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-tight text-espresso md:text-5xl">
            The collection
          </h2>
          <p className="mt-2 font-display italic text-olive/70">
            {recipes.length === 0
              ? "No plates yet"
              : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} clipped`}
          </p>
        </div>
        <label className="block min-w-[16rem] flex-1 md:max-w-xs">
          <span className="sr-only">Search saved recipes</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="w-full rounded-full border border-olive/20 bg-oatmeal px-4 py-2.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="mb-10 flex flex-wrap gap-2">
        <FilterPill active={filter === "all"} onClick={() => onFilter("all")}>
          All
        </FilterPill>
        <FilterPill active={filter === "favorites"} onClick={() => onFilter("favorites")}>
          Kept
        </FilterPill>
        {mealFilters.map((category) => (
          <FilterPill
            key={category}
            active={filter === category}
            onClick={() => onFilter(category)}
          >
            {recipeCategoryLabel(category)}
          </FilterPill>
        ))}
      </div>

      {recipes.length === 0 ? (
        <p className="max-w-md font-display text-2xl italic leading-snug text-olive/70">
          Clip a recipe above. It will land here like a plate in a well-used cookbook.
        </p>
      ) : visible.length === 0 ? (
        <p className="font-display text-2xl italic text-olive/70">
          Nothing on the shelf matches that.
        </p>
      ) : (
        <>
          {lead ? (
            <LeadPlate
              recipe={lead}
              planned={weekRecipeIds.has(lead.id)}
              onOpen={() => onOpen(lead)}
              onFavorite={() => onFavorite(lead)}
              onWeek={() => onWeek(lead)}
              onShop={() => onShop(lead)}
              onDelete={() => onDelete(lead)}
            />
          ) : null}
          {rest.length > 0 ? (
            <div className="mt-12 columns-1 gap-8 sm:columns-2 xl:columns-3">
              {rest.map((item, index) => (
                <RecipePlate
                  key={item.id}
                  recipe={item}
                  planned={weekRecipeIds.has(item.id)}
                  variant={PLATE_VARIANTS[index % PLATE_VARIANTS.length]}
                  onOpen={() => onOpen(item)}
                  onFavorite={() => onFavorite(item)}
                  onWeek={() => onWeek(item)}
                  onShop={() => onShop(item)}
                  onDelete={() => onDelete(item)}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-[0.72rem] tracking-[0.14em] uppercase ${
        active
          ? "border-olive bg-olive text-ivory"
          : "border-olive/20 bg-transparent text-olive"
      }`}
    >
      {children}
    </button>
  );
}

function LeadPlate({
  recipe,
  planned,
  onOpen,
  onFavorite,
  onWeek,
  onShop,
  onDelete,
}: {
  recipe: SavedRecipe;
  planned: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onWeek: () => void;
  onShop: () => void;
  onDelete: () => void;
}) {
  const source = sourceLabel(recipe);
  const blurb =
    recipe.description?.trim() ||
    recipe.ingredients.slice(0, 3).join(" · ") ||
    "Clipped and ready for the kitchen.";

  return (
    <article className="mb-16 grid items-end gap-8 pb-4 md:grid-cols-12">
      <button
        type="button"
        onClick={onOpen}
        className="relative mb-12 border-0 bg-transparent p-0 md:col-span-7 md:mb-6"
      >
        <RecipeImage
          src={recipe.image}
          title={recipe.title}
          className="aspect-[4/5] w-full rounded-3xl md:aspect-[5/6]"
        />
        <div className="absolute right-4 bottom-[-1.4rem] left-8 max-w-[22rem] rounded-3xl border border-olive/12 bg-ivory px-6 py-5 md:right-auto md:left-[18%]">
          <p className="text-[0.68rem] tracking-[0.2em] uppercase text-terracotta">
            Latest clipping
          </p>
          <h3 className="mt-2 font-display text-3xl leading-[1.05] text-espresso md:text-4xl">
            {recipe.title}
          </h3>
        </div>
      </button>
      <div className="flex flex-col justify-end gap-5 pb-2 md:col-span-5 md:min-h-[22rem] md:pl-4">
        <p className="text-[0.7rem] tracking-[0.18em] uppercase text-olive/60">
          {source}
          {clippedOn(recipe.savedAt) ? ` · ${clippedOn(recipe.savedAt)}` : ""}
        </p>
        <p className="max-w-sm text-[1.05rem] leading-relaxed text-olive">{blurb}</p>
        {recipe.categories?.length ? (
          <p className="text-sm text-espresso">
            {recipe.categories.map(recipeCategoryLabel).join("  ·  ")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-olive px-5 py-2.5 text-sm tracking-wide text-ivory"
          >
            Open recipe
          </button>
          <PlateTools
            kept={recipe.favorite}
            planned={planned}
            onFavorite={onFavorite}
            onWeek={onWeek}
            onShop={onShop}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}
