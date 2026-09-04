import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { matchesQuery, parseServings, scaleIngredientLine } from "../shared/ingredients";
import {
  groceryCategoryLabel,
  groupGroceryItems,
  nextGroceryCategory,
} from "../shared/groceryCategories";
import { recipeAsHtml, recipeAsText } from "../shared/share-text";
import { findTimers } from "../shared/timers";
import {
  addGrocery,
  clearCheckedGrocery,
  extractRecipe,
  extractRecipeFromCaption,
  listGrocery,
  listSavedRecipes,
  removeGrocery,
  removeSavedRecipe,
  saveRecipe,
  setGroceryItemCategory,
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
  const { height: windowHeight } = useWindowDimensions();
  const [url, setUrl] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "caption">("url");
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
  const groceryGroups = useMemo(() => groupGroceryItems(grocery), [grocery]);
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

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cookOpen) {
        setCookOpen(false);
        return true;
      }
      if (groceryOpen) {
        setGroceryOpen(false);
        return true;
      }
      if (view === "recipe") {
        setView("home");
        setError(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [cookOpen, groceryOpen, view]);

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

  async function extractCaption(nextText = captionText) {
    const trimmed = nextText.trim();
    if (!trimmed) {
      setError("Paste the recipe caption (ingredients + steps) to continue.");
      return;
    }
    setCaptionText(trimmed);
    setLoading(true);
    setError(null);
    setCookOpen(false);
    try {
      const data = await extractRecipeFromCaption(trimmed, url.trim() || undefined);
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
          <Text style={styles.brandText}>RecipeGuru</Text>
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
          <Text style={styles.titleEm}>Or a Reel caption.</Text>
          <View style={styles.composer}>
            <View style={styles.modeSwitch}>
              <Pressable
                style={[styles.modeBtn, inputMode === "url" && styles.modeBtnOn]}
                onPress={() => setInputMode("url")}
              >
                <Text style={[styles.modeBtnText, inputMode === "url" && styles.modeBtnTextOn]}>
                  URL
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeBtn, inputMode === "caption" && styles.modeBtnOn]}
                onPress={() => setInputMode("caption")}
              >
                <Text
                  style={[styles.modeBtnText, inputMode === "caption" && styles.modeBtnTextOn]}
                >
                  Caption text
                </Text>
              </Pressable>
            </View>
          <View style={styles.urlForm}>
            {inputMode === "url" ? (
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="Recipe blog, Facebook Reel, TikTok…"
                placeholderTextColor="#7f8e89"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
                onSubmitEditing={() => void extract()}
              />
            ) : (
              <TextInput
                value={captionText}
                onChangeText={setCaptionText}
                placeholder={"Ingredients:\n1 cup flour\n...\n\nInstructions:\n1. Mix..."}
                placeholderTextColor="#7f8e89"
                multiline
                style={[styles.input, styles.captionInput]}
                textAlignVertical="top"
              />
            )}
            <View style={styles.formRow}>
              <Pressable
                style={styles.ghost}
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  if (!text) return;
                  if (inputMode === "url") setUrl(text.trim());
                  else setCaptionText(text.trim());
                }}
              >
                <Text style={styles.ghostText}>Paste</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.ghost,
                  ((inputMode === "url" ? !url : !captionText) || loading) && styles.disabled,
                ]}
                disabled={(inputMode === "url" ? !url : !captionText) || loading}
                onPress={() => {
                  if (inputMode === "url") setUrl("");
                  else setCaptionText("");
                  setError(null);
                }}
              >
                <Text style={styles.ghostText}>Clear</Text>
              </Pressable>
              <Pressable
                style={styles.primary}
                onPress={() =>
                  void (inputMode === "url" ? extract() : extractCaption())
                }
              >
                <Text style={styles.primaryText}>{loading ? "Extracting…" : "Extract"}</Text>
              </Pressable>
            </View>
          </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.sectionLabel}>Try one</Text>
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
          <Text style={styles.sectionTitle}>Saved recipes</Text>
          <TextInput
            style={styles.search}
            value={libraryQuery}
            onChangeText={setLibraryQuery}
            placeholder="Search saved recipes"
            placeholderTextColor="#7f8e89"
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
            <ActivityIndicator color="#ff5a3c" />
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

      <Modal
        visible={groceryOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGroceryOpen(false)}
      >
        <SafeAreaView style={styles.groceryWrap} edges={["bottom", "left", "right"]}>
          <View style={styles.groceryCard}>
            <Text style={styles.panelTitle}>Grocery list</Text>
            <ScrollView
              style={[styles.groceryList, { maxHeight: Math.round(windowHeight * 0.52) }]}
              contentContainerStyle={styles.groceryListContent}
              keyboardShouldPersistTaps="handled"
            >
              {grocery.length === 0 ? (
                <Text style={styles.libraryMeta}>
                  Open a recipe and tap Add to grocery for unchecked ingredients.
                </Text>
              ) : (
                <>
                  <Text style={styles.groceryHint}>
                    Sorted by aisle. Tap a category to change it.
                  </Text>
                  {groceryGroups.map((group, index) => (
                    <View key={group.category}>
                      <Text
                        style={[
                          styles.groceryGroupTitle,
                          index === 0 ? { marginTop: 0 } : null,
                        ]}
                      >
                        {group.label}
                      </Text>
                      {group.items.map((item) => (
                        <View key={item.id} style={styles.checkRow}>
                          <Pressable
                            style={{ flex: 1, flexDirection: "row", gap: 8 }}
                            onPress={() => {
                              void setGroceryItemChecked(item.id, !item.checked).then(
                                (updated) => {
                                  setGrocery((current) =>
                                    current.map((row) =>
                                      row.id === updated.id ? updated : row,
                                    ),
                                  );
                                },
                              );
                            }}
                          >
                            <Check checked={item.checked} />
                            <Text style={styles.checkLabel}>{item.label}</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              void setGroceryItemCategory(
                                item.id,
                                nextGroceryCategory(item.category),
                              ).then((updated) => {
                                setGrocery((current) =>
                                  current.map((row) =>
                                    row.id === updated.id ? updated : row,
                                  ),
                                );
                              });
                            }}
                          >
                            <Text style={styles.groceryCatChip}>
                              {groceryCategoryLabel(item.category)}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              void removeGrocery(item.id).then(() => {
                                setGrocery((current) =>
                                  current.filter((row) => row.id !== item.id),
                                );
                              });
                            }}
                          >
                            <Text style={styles.groceryRemove}>Remove</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
            <Pressable
              style={styles.groceryGhost}
              onPress={() => void clearCheckedGrocery().then(setGrocery)}
            >
              <Text style={styles.groceryGhostText}>Clear checked</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => setGroceryOpen(false)}>
              <Text style={styles.primaryText}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
  safe: { flex: 1, backgroundColor: "#0e1519" },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(247,243,235,0.1)",
  },
  topActions: { flexDirection: "row", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#ff5a3c",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: { color: "#fff8f5", fontWeight: "800" },
  brandText: { color: "#f7f3eb", fontWeight: "700", fontSize: 17 },
  hero: { padding: 20, paddingBottom: 48, gap: 12 },
  eyebrow: { color: "#5ec8b6", letterSpacing: 2.2, textTransform: "uppercase", fontSize: 12, fontWeight: "600" },
  title: { color: "#f7f3eb", fontSize: 36, fontWeight: "700" },
  titleEm: { color: "#e8b86d", fontSize: 32, fontStyle: "italic" },
  composer: {
    backgroundColor: "#172126",
    borderColor: "rgba(247,243,235,0.1)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 10,
    gap: 10,
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  modeBtn: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: "center" },
  modeBtnOn: { backgroundColor: "#1c2a31" },
  modeBtnText: { color: "#9aa8a3", fontWeight: "700" },
  modeBtnTextOn: { color: "#f7f3eb" },
  urlForm: { gap: 10 },
  input: {
    color: "#f7f3eb",
    fontSize: 16,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 14,
  },
  captionInput: { minHeight: 140 },
  formRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  primary: { backgroundColor: "#ff5a3c", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: "#fff8f5", fontWeight: "700", textAlign: "center" },
  ghost: {
    borderWidth: 1,
    borderColor: "rgba(247,243,235,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ghostText: { color: "#f7f3eb", fontWeight: "600" },
  error: { color: "#ff9b8a" },
  sectionLabel: {
    color: "#9aa8a3",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 8,
  },
  sectionTitle: { color: "#f7f3eb", fontSize: 22, fontWeight: "700", marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(247,243,235,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#172126",
  },
  chipOn: { backgroundColor: "rgba(255,90,60,0.18)", borderColor: "rgba(255,90,60,0.7)" },
  chipText: { color: "#f7f3eb" },
  search: {
    borderWidth: 1,
    borderColor: "rgba(247,243,235,0.12)",
    borderRadius: 14,
    color: "#f7f3eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#172126",
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#172126",
    borderColor: "rgba(247,243,235,0.1)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 8,
  },
  libraryOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  libraryImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#1c2a31",
    alignItems: "center",
    justifyContent: "center",
  },
  libraryName: { color: "#f7f3eb", fontWeight: "700" },
  libraryMeta: { color: "#9aa8a3" },
  recipe: { padding: 16, paddingBottom: 48, gap: 12 },
  recipeImage: { width: "100%", height: 210, borderRadius: 22, backgroundColor: "#1c2a31" },
  recipeTitle: { color: "#f7f3eb", fontSize: 30, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    borderWidth: 1,
    borderColor: "rgba(247,243,235,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: { color: "#f7f3eb", fontSize: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  panel: { backgroundColor: "#f7f3eb", borderRadius: 22, padding: 16, gap: 6 },
  panelTitle: { color: "#142018", fontSize: 22, fontWeight: "700" },
  checkRow: { flexDirection: "row", gap: 10, paddingVertical: 8, alignItems: "flex-start" },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ff5a3c",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: "#ff5a3c" },
  checkMark: { color: "#fff8f5", fontWeight: "800", fontSize: 12 },
  checkLabel: { flex: 1, color: "#142018", fontSize: 16 },
  stepCard: { flexDirection: "row", gap: 12, backgroundColor: "#efe8db", borderRadius: 18, padding: 12 },
  stepIndex: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#142018",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: { color: "#f7f3eb", fontWeight: "800", fontSize: 18 },
  stepText: { color: "#142018", fontSize: 17, lineHeight: 24 },
  textBtn: { color: "#142018", fontWeight: "700", marginTop: 8 },
  timerChip: { color: "#ff5a3c", textDecorationLine: "underline", fontWeight: "700" },
  editArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(20,32,24,0.12)",
    borderRadius: 12,
    padding: 10,
    color: "#142018",
    textAlignVertical: "top",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8,12,14,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#172126",
    borderRadius: 18,
    padding: 16,
  },
  loadingText: { color: "#f7f3eb", flexShrink: 1 },
  cook: { flex: 1, backgroundColor: "#081014" },
  cookBar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  cookBarText: { color: "#9aa8a3", flex: 1, textTransform: "uppercase" },
  cookStage: { padding: 20, gap: 12 },
  cookStep: { color: "#fff8ef", fontSize: 32, lineHeight: 40, fontWeight: "700" },
  cookNav: { flexDirection: "row", gap: 10, padding: 16 },
  cookNavBtn: { flex: 1, alignItems: "center", minHeight: 52, justifyContent: "center" },
  groceryWrap: {
    flex: 1,
    backgroundColor: "rgba(8,12,14,0.7)",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  groceryCard: {
    backgroundColor: "#f7f3eb",
    borderRadius: 22,
    padding: 16,
    gap: 8,
    overflow: "hidden",
  },
  groceryList: { flexGrow: 0 },
  groceryListContent: { paddingBottom: 4 },
  groceryHint: { color: "#5c6a62", fontSize: 13, marginBottom: 4 },
  groceryGroupTitle: {
    color: "#5c6a62",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 2,
  },
  groceryCatChip: {
    color: "#5c6a62",
    fontSize: 12,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "rgba(20,32,24,0.14)",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groceryRemove: { color: "#142018", fontWeight: "700", fontSize: 14 },
  groceryGhost: {
    borderWidth: 1,
    borderColor: "rgba(20,32,24,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groceryGhostText: { color: "#142018", fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.45 },
});
