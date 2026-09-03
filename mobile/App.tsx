import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { matchesQuery, parseServings, scaleIngredientLine } from "../shared/ingredients";
import { recipeAsHtml, recipeAsText } from "../shared/share-text";
import { findTimers } from "../shared/timers";
import {
  addGrocery,
  clearCheckedGrocery,
  extractRecipe,
  listGrocery,
  listSavedRecipes,
  removeGrocery,
  removeSavedRecipe,
  saveRecipe,
  setGroceryItemChecked,
  setRecipeFavorite,
  updateSavedRecipe,
} from "./src/api";
import { useCookTimers } from "./src/kitchen";
import type { GroceryItem, Recipe, SavedRecipe, TimerMatch } from "./src/types";

const EXAMPLES = [
  { label: "Lentil soup", url: "https://cookieandkate.com/best-lentil-soup-recipe/" },
  { label: "Banana bread", url: "https://www.loveandlemons.com/banana-bread/" },
  { label: "Vegan paella", url: "https://minimalistbaker.com/easy-vegan-paella/" },
];

function recipeKey(recipe: Pick<Recipe, "sourceUrl">): string {
  return recipe.sourceUrl.replace(/\/$/, "");
}

function urlFromLink(link: string): string | null {
  try {
    const parsed = new URL(link);
    if (parsed.protocol === "recipeextract:") {
      return parsed.searchParams.get("url");
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return link;
  } catch {
    // Fall through.
  }
  const match = link.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppInner />
    </SafeAreaProvider>
  );
}

function AppInner() {
  const [url, setUrl] = useState("");
  const [view, setView] = useState<"home" | "recipe">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());
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

  const savedMatch = useMemo(() => {
    if (!recipe) return null;
    return savedRecipes.find((item) => recipeKey(item) === recipeKey(recipe)) ?? null;
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
    if (cookOpen) void activateKeepAwakeAsync("cook");
    else void deactivateKeepAwake("cook");
    return () => {
      void deactivateKeepAwake("cook");
    };
  }, [cookOpen]);

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
      const data = await extractRecipe(trimmed);
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

  useEffect(() => {
    function consume(link: string) {
      const next = urlFromLink(link);
      if (next) void extract(next);
    }
    const sub = Linking.addEventListener("url", (event) => consume(event.url));
    void Linking.getInitialURL().then((link) => {
      if (link) consume(link);
    });
    return () => sub.remove();
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
  }, [recipe?.sourceUrl, savedMatch?.id]);

  function toggleSet(setter: (value: Set<number> | ((current: Set<number>) => Set<number>)) => void, index: number) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function upsertSaved(saved: SavedRecipe) {
    setSavedRecipes((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    if (recipe && recipeKey(recipe) === recipeKey(saved)) setRecipe({ ...saved });
  }

  async function persistPatch(patch: Parameters<typeof updateSavedRecipe>[1]) {
    const target = savedMatch ?? (recipe ? await saveRecipe(recipe) : null);
    if (!target) return;
    upsertSaved(await updateSavedRecipe(target.id, patch));
  }

  async function handleSave() {
    if (!recipe) return;
    setLibraryBusy(true);
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

  async function handleAddGrocery() {
    if (!recipe) return;
    const ingredients = scaledIngredients.filter((_line, index) => !checkedIngredients.has(index));
    if (!ingredients.length) {
      setError("Uncheck the ingredients you still need, then add them.");
      return;
    }
    setGrocery(
      await addGrocery({
        ingredients,
        recipeId: savedMatch?.id,
        recipeTitle: recipe.title,
      }),
    );
    setGroceryOpen(true);
  }

  async function printRecipe() {
    if (!recipe) return;
    const file = await Print.printToFileAsync({ html: recipeAsHtml(recipe) });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
    }
  }

  const metaBits = [
    `${servings} serving${servings === 1 ? "" : "s"}`,
    recipe?.prepTime ? `Prep ${recipe.prepTime}` : null,
    recipe?.cookTime ? `Cook ${recipe.cookTime}` : null,
    recipe?.totalTime ? `Total ${recipe.totalTime}` : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topbar}>
        <Pressable
          style={styles.brand}
          onPress={() => {
            setView("home");
            setCookOpen(false);
            setError(null);
          }}
        >
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>R</Text>
          </View>
          <Text style={styles.brandText}>RecipeExtract</Text>
        </Pressable>
        <View style={styles.topActions}>
          <Pressable style={styles.ghost} onPress={() => setGroceryOpen(true)}>
            <Text style={styles.ghostText}>
              Grocery {grocery.filter((item) => !item.checked).length}
            </Text>
          </Pressable>
        </View>
      </View>

      {view === "home" ? (
        <ScrollView contentContainerStyle={styles.hero} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Skip the blog. Keep the recipe.</Text>
          <Text style={styles.title}>Paste a URL.</Text>
          <Text style={styles.titleEm}>Cook the actual recipe.</Text>
          <View style={styles.urlForm}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com/your-favorite-recipe"
              placeholderTextColor="#8d7f6e"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
              onSubmitEditing={() => void extract()}
            />
            <View style={styles.formRow}>
              <Pressable
                style={styles.ghost}
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  if (text) setUrl(text.trim());
                }}
              >
                <Text style={styles.ghostText}>Paste</Text>
              </Pressable>
              <Pressable
                style={[styles.ghost, (!url || loading) && styles.disabled]}
                disabled={!url || loading}
                onPress={() => {
                  setUrl("");
                  setError(null);
                }}
              >
                <Text style={styles.ghostText}>Clear</Text>
              </Pressable>
              <Pressable style={styles.primary} onPress={() => void extract()}>
                <Text style={styles.primaryText}>{loading ? "Extracting…" : "Extract"}</Text>
              </Pressable>
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.chips}>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example.url}
                style={styles.chip}
                onPress={() => void extract(example.url)}
              >
                <Text style={styles.chipText}>{example.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.search}
            value={libraryQuery}
            onChangeText={setLibraryQuery}
            placeholder="Search saved recipes"
            placeholderTextColor="#8d7f6e"
          />
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, libraryFilter === "all" && styles.chipOn]}
              onPress={() => setLibraryFilter("all")}
            >
              <Text style={styles.chipText}>All {savedRecipes.length}</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, libraryFilter === "favorites" && styles.chipOn]}
              onPress={() => setLibraryFilter("favorites")}
            >
              <Text style={styles.chipText}>
                Favorites {savedRecipes.filter((item) => item.favorite).length}
              </Text>
            </Pressable>
          </View>
          {savedRecipes
            .filter((item) => (libraryFilter === "favorites" ? item.favorite : true))
            .filter((item) => matchesQuery(item, libraryQuery))
            .map((item) => (
              <View key={item.id} style={styles.libraryCard}>
                <Pressable
                  style={styles.libraryOpen}
                  onPress={() => {
                    setRecipe(item);
                    setUrl(item.sourceUrl);
                    setCheckedIngredients(new Set());
                    setDoneSteps(new Set());
                    setView("recipe");
                  }}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.libraryImage} />
                  ) : (
                    <View style={styles.libraryImage}>
                      <Text style={styles.brandMarkText}>R</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libraryName}>{item.title}</Text>
                    <Text style={styles.libraryMeta}>
                      {item.sourceName ?? "Saved"}
                      {item.tags.length ? ` · ${item.tags.join(", ")}` : ""}
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => void handleFavorite(item)}>
                  <Text style={styles.chipText}>{item.favorite ? "★" : "☆"}</Text>
                </Pressable>
              </View>
            ))}
        </ScrollView>
      ) : null}

      {view === "recipe" && recipe ? (
        <ScrollView contentContainerStyle={styles.recipe}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
          ) : null}
          {editing ? (
            <TextInput style={styles.search} value={draftTitle} onChangeText={setDraftTitle} />
          ) : (
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
          )}
          <View style={styles.metaRow}>
            {metaBits.map((bit) => (
              <View key={bit} style={styles.metaChip}>
                <Text style={styles.metaText}>{bit}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.ghost} onPress={() => setServings(Math.max(1, servings - 1))}>
              <Text style={styles.ghostText}>−</Text>
            </Pressable>
            <Text style={styles.ghostText}>{servings} servings</Text>
            <Pressable style={styles.ghost} onPress={() => setServings(servings + 1)}>
              <Text style={styles.ghostText}>+</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setServings(Math.max(1, Math.round(servings / 2)))}>
              <Text style={styles.chipText}>½×</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setServings(servings * 2)}>
              <Text style={styles.chipText}>2×</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={() => { setCookIndex(0); setCookOpen(true); }}>
              <Text style={styles.primaryText}>Start cooking</Text>
            </Pressable>
            <Pressable style={styles.ghost} disabled={libraryBusy || Boolean(savedMatch)} onPress={() => void handleSave()}>
              <Text style={styles.ghostText}>{savedMatch ? "Saved" : "Save"}</Text>
            </Pressable>
            <Pressable style={[styles.ghost, savedMatch?.favorite && styles.chipOn]} onPress={() => void handleFavorite(savedMatch)}>
              <Text style={styles.ghostText}>{savedMatch?.favorite ? "★ Favorited" : "☆ Favorite"}</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => void handleAddGrocery()}>
              <Text style={styles.ghostText}>Grocery</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() =>
                void Share.share({
                  message: recipeAsText(recipe, { notes: savedMatch?.notes, tags: savedMatch?.tags }),
                })
              }
            >
              <Text style={styles.ghostText}>Share</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => void printRecipe()}>
              <Text style={styles.ghostText}>PDF</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => setEditing((value) => !value)}>
              <Text style={styles.ghostText}>{editing ? "Cancel" : "Edit"}</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() => {
                setView("home");
                setError(null);
              }}
            >
              <Text style={styles.ghostText}>New URL</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Ingredients</Text>
            {editing ? (
              <TextInput
                style={styles.editArea}
                multiline
                value={draftIngredients}
                onChangeText={setDraftIngredients}
              />
            ) : (
              scaledIngredients.map((ingredient, index) => (
                <Pressable
                  key={`${index}-${ingredient}`}
                  style={styles.checkRow}
                  onPress={() => toggleSet(setCheckedIngredients, index)}
                >
                  <Check checked={checkedIngredients.has(index)} />
                  <Text style={styles.checkLabel}>{ingredient}</Text>
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Steps</Text>
            {editing ? (
              <>
                <TextInput style={styles.search} value={draftYield} onChangeText={setDraftYield} placeholder="Yield" />
                <TextInput style={styles.editArea} multiline value={draftSteps} onChangeText={setDraftSteps} />
                <Pressable
                  style={styles.primary}
                  onPress={() => {
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
                    void persistPatch({
                      title: next.title,
                      yield: next.yield,
                      ingredients,
                      steps,
                      notes: draftNotes,
                    });
                    setEditing(false);
                  }}
                >
                  <Text style={styles.primaryText}>Save edits</Text>
                </Pressable>
              </>
            ) : (
              recipe.steps.map((step, index) => (
                <View key={`${index}-${step.slice(0, 20)}`} style={styles.stepCard}>
                  <Pressable style={styles.stepIndex} onPress={() => { setCookIndex(index); setCookOpen(true); }}>
                    <Text style={styles.stepIndexText}>{String(index + 1).padStart(2, "0")}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <TimedText text={step} onStart={timers.startTimer} />
                    <Pressable onPress={() => toggleSet(setDoneSteps, index)}>
                      <Text style={styles.textBtn}>{doneSteps.has(index) ? "Undo" : "Mark done"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Notes & tags</Text>
            <View style={styles.chips}>
              {(savedMatch?.tags ?? []).map((tag) => (
                <Pressable
                  key={tag}
                  style={[styles.chip, styles.chipOn]}
                  onPress={() =>
                    void persistPatch({
                      tags: (savedMatch?.tags ?? []).filter((item) => item !== tag),
                    })
                  }
                >
                  <Text style={styles.chipText}>{tag} ×</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.search}
              value={draftTag}
              onChangeText={setDraftTag}
              placeholder="Add tag"
              onSubmitEditing={() => {
                const tag = draftTag.trim().toLowerCase();
                if (!tag) return;
                setDraftTag("");
                void persistPatch({ tags: Array.from(new Set([...(savedMatch?.tags ?? []), tag])) });
              }}
            />
            <TextInput
              style={styles.editArea}
              multiline
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="Cook’s note"
            />
            <Pressable style={styles.ghost} onPress={() => void persistPatch({ notes: draftNotes })}>
              <Text style={styles.ghostText}>Save notes</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#e4572e" />
            <Text style={styles.loadingText}>Reading the page and cutting the filler…</Text>
          </View>
        </View>
      ) : null}

      <CookMode
        visible={cookOpen && Boolean(recipe)}
        recipe={recipe}
        ingredients={scaledIngredients}
        index={cookIndex}
        showIngredients={showCookIngredients}
        checkedIngredients={checkedIngredients}
        timers={timers.timers}
        onStartTimer={timers.startTimer}
        onCancelTimer={timers.cancelTimer}
        onToggleIngredient={(index) => toggleSet(setCheckedIngredients, index)}
        onToggleIngredients={() => setShowCookIngredients((value) => !value)}
        onClose={() => setCookOpen(false)}
        onIndex={setCookIndex}
        onMarkDone={() => {
          toggleSet(setDoneSteps, cookIndex);
          if (recipe && cookIndex < recipe.steps.length - 1) setCookIndex((index) => index + 1);
          else setCookOpen(false);
        }}
      />

      <Modal visible={groceryOpen} animationType="slide" transparent>
        <View style={styles.groceryWrap}>
          <View style={styles.groceryCard}>
            <Text style={styles.panelTitle}>Grocery list</Text>
            {grocery.map((item) => (
              <View key={item.id} style={styles.checkRow}>
                <Pressable
                  style={{ flex: 1, flexDirection: "row", gap: 8 }}
                  onPress={() => {
                    void setGroceryItemChecked(item.id, !item.checked).then((updated) => {
                      setGrocery((current) =>
                        current.map((row) => (row.id === updated.id ? updated : row)),
                      );
                    });
                  }}
                >
                  <Check checked={item.checked} />
                  <Text style={styles.checkLabel}>{item.label}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void removeGrocery(item.id).then(() => {
                      setGrocery((current) => current.filter((row) => row.id !== item.id));
                    });
                  }}
                >
                  <Text style={styles.textBtn}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.ghost}
              onPress={() => void clearCheckedGrocery().then(setGrocery)}
            >
              <Text style={styles.ghostText}>Clear checked</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => setGroceryOpen(false)}>
              <Text style={styles.primaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TimedText({
  text,
  onStart,
  large,
}: {
  text: string;
  onStart: (match: TimerMatch) => void;
  large?: boolean;
}) {
  const matches = findTimers(text);
  if (!matches.length) {
    return <Text style={large ? styles.cookStep : styles.stepText}>{text}</Text>;
  }
  const parts: { text: string; match?: TimerMatch }[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start) });
    parts.push({ text: match.label, match });
    cursor = match.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return (
    <Text style={large ? styles.cookStep : styles.stepText}>
      {parts.map((part, index) =>
        part.match ? (
          <Text key={`${part.match.start}-${index}`} style={styles.timerChip} onPress={() => onStart(part.match!)}>
            {part.text}
          </Text>
        ) : (
          <Text key={`t-${index}`}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

function CookMode({
  visible,
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
  visible: boolean;
  recipe: Recipe | null;
  ingredients: string[];
  index: number;
  showIngredients: boolean;
  checkedIngredients: Set<number>;
  timers: { id: string; label: string; display: string }[];
  onStartTimer: (match: TimerMatch) => void;
  onCancelTimer: (id: string) => void;
  onToggleIngredient: (index: number) => void;
  onToggleIngredients: () => void;
  onClose: () => void;
  onIndex: (index: number) => void;
  onMarkDone: () => void;
}) {
  if (!recipe) return null;
  const total = recipe.steps.length;
  const step = recipe.steps[index] ?? "";
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaProvider>
        <SafeAreaView style={styles.cook}>
          <View style={styles.cookBar}>
            <Text style={styles.cookBarText}>
              Step {index + 1} of {total}
            </Text>
            <Pressable style={styles.ghost} onPress={onToggleIngredients}>
              <Text style={styles.ghostText}>{showIngredients ? "Hide list" : "Ingredients"}</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={onClose}>
              <Text style={styles.ghostText}>Exit</Text>
            </Pressable>
          </View>
          {timers.map((timer) => (
            <Pressable key={timer.id} style={styles.chip} onPress={() => onCancelTimer(timer.id)}>
              <Text style={styles.chipText}>
                {timer.display} {timer.label}
              </Text>
            </Pressable>
          ))}
          <ScrollView contentContainerStyle={styles.cookStage}>
            <TimedText text={step} onStart={onStartTimer} large />
            {showIngredients
              ? (
                <View style={styles.panel}>
                  {ingredients.map((ingredient, ingredientIndex) => (
                    <Pressable
                      key={`${ingredientIndex}-${ingredient}`}
                      style={styles.checkRow}
                      onPress={() => onToggleIngredient(ingredientIndex)}
                    >
                      <Check checked={checkedIngredients.has(ingredientIndex)} />
                      <Text style={styles.checkLabel}>{ingredient}</Text>
                    </Pressable>
                  ))}
                </View>
              )
              : null}
          </ScrollView>
          <View style={styles.cookNav}>
            <Pressable
              style={[styles.ghost, styles.cookNavBtn, index <= 0 && styles.disabled]}
              disabled={index <= 0}
              onPress={() => onIndex(index - 1)}
            >
              <Text style={styles.ghostText}>Previous</Text>
            </Pressable>
            <Pressable style={[styles.primary, styles.cookNavBtn]} onPress={onMarkDone}>
              <Text style={styles.primaryText}>{index >= total - 1 ? "Done" : "Next step"}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Check({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.check, checked && styles.checkOn]}>
      {checked ? <Text style={styles.checkMark}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#14110e" },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topActions: { flexDirection: "row", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e4572e",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: { color: "#fff7ef", fontWeight: "800" },
  brandText: { color: "#f4ead7", fontWeight: "700", fontSize: 17 },
  hero: { padding: 20, paddingBottom: 48, gap: 10 },
  eyebrow: { color: "#c9b79a", letterSpacing: 2, textTransform: "uppercase", fontSize: 12 },
  title: { color: "#f4ead7", fontSize: 36, fontWeight: "700" },
  titleEm: { color: "#f0b9a5", fontSize: 32, fontStyle: "italic" },
  urlForm: {
    backgroundColor: "#1d1814",
    borderColor: "rgba(244,234,215,0.14)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    gap: 10,
  },
  input: { color: "#f4ead7", fontSize: 16, padding: 10 },
  formRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  primary: { backgroundColor: "#e4572e", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: "#fff7ef", fontWeight: "700", textAlign: "center" },
  ghost: {
    borderWidth: 1,
    borderColor: "rgba(244,234,215,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ghostText: { color: "#f4ead7", fontWeight: "600" },
  error: { color: "#ffb4a2" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(244,234,215,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: "rgba(228,87,46,0.2)", borderColor: "rgba(228,87,46,0.7)" },
  chipText: { color: "#f4ead7" },
  search: {
    borderWidth: 1,
    borderColor: "rgba(244,234,215,0.14)",
    borderRadius: 12,
    color: "#f4ead7",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1d1814",
    borderColor: "rgba(244,234,215,0.14)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
  },
  libraryOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  libraryImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#2a221c",
    alignItems: "center",
    justifyContent: "center",
  },
  libraryName: { color: "#f4ead7", fontWeight: "700" },
  libraryMeta: { color: "#c9b79a" },
  recipe: { padding: 16, paddingBottom: 48, gap: 10 },
  recipeImage: { width: "100%", height: 200, borderRadius: 18, backgroundColor: "#2a221c" },
  recipeTitle: { color: "#f4ead7", fontSize: 30, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    borderWidth: 1,
    borderColor: "rgba(244,234,215,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: { color: "#f4ead7", fontSize: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  panel: { backgroundColor: "#f4ead7", borderRadius: 20, padding: 16, gap: 6 },
  panelTitle: { color: "#1a1209", fontSize: 22, fontWeight: "700" },
  checkRow: { flexDirection: "row", gap: 10, paddingVertical: 8, alignItems: "flex-start" },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#e4572e",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: "#e4572e" },
  checkMark: { color: "#fff7ef", fontWeight: "800", fontSize: 12 },
  checkLabel: { flex: 1, color: "#1a1209", fontSize: 16 },
  stepCard: { flexDirection: "row", gap: 12, backgroundColor: "#efe3cc", borderRadius: 16, padding: 12 },
  stepIndex: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1a1209",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: { color: "#f4ead7", fontWeight: "800", fontSize: 18 },
  stepText: { color: "#1a1209", fontSize: 17, lineHeight: 24 },
  textBtn: { color: "#1a1209", fontWeight: "700", marginTop: 8 },
  timerChip: { color: "#e4572e", textDecorationLine: "underline", fontWeight: "700" },
  editArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(26,18,9,0.14)",
    borderRadius: 12,
    padding: 10,
    color: "#1a1209",
    textAlignVertical: "top",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(20,17,14,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1d1814",
    borderRadius: 16,
    padding: 16,
  },
  loadingText: { color: "#f4ead7", flexShrink: 1 },
  cook: { flex: 1, backgroundColor: "#090807" },
  cookBar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  cookBarText: { color: "#d8cbb6", flex: 1, textTransform: "uppercase" },
  cookStage: { padding: 20, gap: 12 },
  cookStep: { color: "#fff8ef", fontSize: 32, lineHeight: 40, fontWeight: "700" },
  cookNav: { flexDirection: "row", gap: 10, padding: 16 },
  cookNavBtn: { flex: 1, alignItems: "center", minHeight: 52, justifyContent: "center" },
  groceryWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 16 },
  groceryCard: { backgroundColor: "#f4ead7", borderRadius: 18, padding: 16, maxHeight: "80%", gap: 8 },
  disabled: { opacity: 0.45 },
});
