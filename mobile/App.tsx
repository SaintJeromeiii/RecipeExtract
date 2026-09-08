import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { firstHttpUrl, isSocialUrl } from "../shared/social";
import { EXTRACT_WAIT_HINT, SAMPLE_RECIPE } from "../shared/recipeQuality";
import { matchesQuery, parseServings, scaleIngredientLine } from "../shared/ingredients";
import { parseShopLines, sortWeeklyMeals } from "../shared/weekly";
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
  recipeMatchesCategory,
  toggleRecipeCategory,
} from "../shared/recipeCategories";
import { recipeAsHtml, recipeAsText } from "../shared/share-text";
import { findTimers } from "../shared/timers";
import {
  addGrocery,
  addWeeklyMeal,
  clearAllGrocery,
  clearCheckedGrocery,
  clearWeeklyMeals,
  extractRecipe,
  extractRecipeFromCaption,
  exportKitchen,
  importKitchen,
  loadHouseholdKey,
  saveHouseholdKey,
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
} from "./src/api";
import { useCookTimers } from "./src/kitchen";
import { ErrorBoundary } from "./src/ErrorBoundary";
import type {
  GroceryCategory,
  GroceryItem,
  Recipe,
  RecipeCategory,
  SavedRecipe,
  TimerMatch,
  WeeklyMeal,
} from "./src/types";

type LibraryFilter = "all" | "favorites" | RecipeCategory;

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
  return firstHttpUrl(link);
}

const ONBOARD_KEY = "recipeextract.onboarded.v1";
const extraUrls = Constants.expoConfig?.extra as
  | { privacyUrl?: string; testersUrl?: string }
  | undefined;
const PRIVACY_URL =
  extraUrls?.privacyUrl || "https://recipeextract-production.up.railway.app/privacy.html";
const TESTERS_URL =
  extraUrls?.testersUrl || "https://recipeextract-production.up.railway.app/testers.html";

export default function App() {
  return (
    <ShareIntentProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <AppInner />
        </ErrorBoundary>
      </SafeAreaProvider>
    </ShareIntentProvider>
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
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyMeal[]>([]);
  const [weeklyTitle, setWeeklyTitle] = useState("");
  const [weeklyShop, setWeeklyShop] = useState("");
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<GroceryCategory[]>(() =>
    resolveCategoryOrder(),
  );
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [arrangeAisles, setArrangeAisles] = useState(false);
  const [assigningItem, setAssigningItem] = useState<GroceryItem | null>(null);
  const groceryGroups = useMemo(
    () => groupGroceryItems(grocery, categoryOrder),
    [grocery, categoryOrder],
  );
  const [servings, setServings] = useState(4);
  const [baseServings, setBaseServings] = useState(4);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftYield, setDraftYield] = useState("");
  const [draftIngredients, setDraftIngredients] = useState("");
  const [draftSteps, setDraftSteps] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftTag, setDraftTag] = useState("");
  const [groceryDraft, setGroceryDraft] = useState("");
  const [removedRecipe, setRemovedRecipe] = useState<SavedRecipe | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loadingHint, setLoadingHint] = useState("Reading the page and cutting the filler…");
  const [householdKey, setHouseholdKey] = useState("");
  const [householdSaved, setHouseholdSaved] = useState(false);
  const timers = useCookTimers();
  const offeredClipboard = useRef("");
  const { shareIntent, resetShareIntent } = useShareIntentContext();

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
    void listWeeklyMeals().then(setWeekly).catch(() => {});
    void loadHouseholdKey().then(setHouseholdKey).catch(() => {});
    void listGrocery()
      .then(({ items, categoryOrder: order }) => {
        setGrocery(items);
        setCategoryOrder(order);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!removedRecipe) return;
    const timer = setTimeout(() => setRemovedRecipe(null), 8000);
    return () => clearTimeout(timer);
  }, [removedRecipe?.id]);

  useEffect(() => {
    if (cookOpen) void activateKeepAwakeAsync("cook");
    else void deactivateKeepAwake("cook");
    return () => {
      void deactivateKeepAwake("cook");
    };
  }, [cookOpen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (helpOpen) {
        setHelpOpen(false);
        return true;
      }
      if (cookOpen) {
        setCookOpen(false);
        return true;
      }
      if (assigningItem) {
        setAssigningItem(null);
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
  }, [assigningItem, cookOpen, groceryOpen, helpOpen, view]);

  async function extract(nextUrl = url) {
    const trimmed = nextUrl.trim();
    if (!trimmed) {
      setError("Paste a recipe URL to get started.");
      return;
    }
    const extracted = firstHttpUrl(trimmed) || trimmed;
    setUrl(extracted);
    setLoading(true);
    setLoadingHint(
      isSocialUrl(extracted)
        ? EXTRACT_WAIT_HINT
        : "Reading the page and cutting the filler…",
    );
    setError(null);
    setCookOpen(false);
    try {
      const data = await extractRecipe(extracted);
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
      setError("Paste the recipe caption (ingredients + steps) to continue.");
      return;
    }
    setCaptionText(trimmed);
    setLoading(true);
    setLoadingHint("Turning that caption into a recipe…");
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
      setInputMode("caption");
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
    const text = `${shareIntent?.webUrl ?? ""} ${shareIntent?.text ?? ""}`.trim();
    const next = urlFromLink(text) || firstHttpUrl(text);
    if (!next) return;
    resetShareIntent();
    void extract(next);
  }, [shareIntent]);

  useEffect(() => {
    void AsyncStorage.getItem(ONBOARD_KEY).then((value) => {
      if (!value) setHelpOpen(true);
    });
  }, []);

  useEffect(() => {
    async function maybeUseClipboard() {
      if (loading) return;
      const text = (await Clipboard.getStringAsync()).trim();
      const next = urlFromLink(text) || firstHttpUrl(text);
      if (!next || next === offeredClipboard.current) return;
      offeredClipboard.current = next;
      Alert.alert("Use the recipe link on your clipboard?", next, [
        { text: "Not now", style: "cancel" },
        { text: "Extract", onPress: () => void extract(next) },
      ]);
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void maybeUseClipboard();
    });
    const timer = setTimeout(() => void maybeUseClipboard(), 900);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
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

  function upsertWeekly(meal: WeeklyMeal) {
    setWeekly((current) =>
      current.some((item) => item.id === meal.id)
        ? current.map((item) => (item.id === meal.id ? meal : item))
        : [...current, meal],
    );
  }

  async function handleAddWeeklyRecipe(target: SavedRecipe) {
    setError(null);
    const result = await addWeeklyMeal({ recipeId: target.id });
    upsertWeekly(result.meal);
    setGrocery(result.grocery);
  }

  async function handleAddWeeklyCustom() {
    const trimmed = weeklyTitle.trim();
    if (!trimmed) return;
    setError(null);
    const result = await addWeeklyMeal({
      title: trimmed,
      ingredients: parseShopLines(weeklyShop),
    });
    upsertWeekly(result.meal);
    setGrocery(result.grocery);
    setWeeklyTitle("");
    setWeeklyShop("");
  }

  async function handleWeeklyFromRecipe() {
    if (!recipe) return;
    const saved = savedMatch ?? (await saveRecipe(recipe));
    if (!savedMatch) upsertSaved(saved);
    await handleAddWeeklyRecipe(saved);
  }

  async function handleRemoveWeekly(meal: WeeklyMeal) {
    await removeWeeklyMeal(meal.id);
    setWeekly((current) => current.filter((item) => item.id !== meal.id));
  }

  async function handleToggleWeekly(meal: WeeklyMeal, checked: boolean) {
    upsertWeekly(await updateWeeklyMeal(meal.id, { checked }));
  }

  const weekRecipeIds = useMemo(
    () => new Set(weekly.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id))),
    [weekly],
  );

  async function handleShopRecipe(target: SavedRecipe) {
    if (!target.ingredients.length) {
      setError("That recipe has no ingredients to shop.");
      return;
    }
    setError(null);
    setGrocery(
      await addGrocery({
        ingredients: target.ingredients,
        recipeId: target.id,
        recipeTitle: target.title,
      }),
    );
    setGroceryOpen(true);
  }

  async function handleAddGroceryLine() {
    const trimmed = groceryDraft.trim();
    if (!trimmed) return;
    setGrocery(await addGrocery({ ingredients: [trimmed] }));
    setGroceryDraft("");
  }

  async function openSample() {
    setError(null);
    setRecipe(SAMPLE_RECIPE);
    setUrl(SAMPLE_RECIPE.sourceUrl);
    setCheckedIngredients(new Set());
    setDoneSteps(new Set());
    setCookIndex(0);
    setView("recipe");
  }

  async function handleExportKitchen() {
    try {
      const json = await exportKitchen();
      await Share.share({
        title: "RecipeGuru backup",
        message: json,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export recipes.");
    }
  }

  async function handleImportKitchen() {
    try {
      const raw = (await Clipboard.getStringAsync()).trim();
      if (!raw.startsWith("{")) {
        Alert.alert(
          "No backup on the clipboard",
          "Copy a RecipeGuru backup JSON, then tap Restore backup again.",
        );
        return;
      }
      const result = await importKitchen(raw);
      setSavedRecipes(await listSavedRecipes());
      setWeekly(await listWeeklyMeals());
      const groceryState = await listGrocery();
      setGrocery(groceryState.items);
      setCategoryOrder(groceryState.categoryOrder);
      Alert.alert(
        "Backup restored",
        `Merged recipes from the clipboard. Library now has your previous saves plus the backup (${result.recipes} recipes in the file).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore that backup.");
    }
  }

  function handleReport() {
    void Share.share({
      title: "RecipeGuru problem",
      message: [
        "RecipeGuru test report",
        url ? `URL: ${url}` : "",
        error ? `Error: ${error}` : "",
        "What happened:",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  function dismissHelp() {
    setHelpOpen(false);
    void AsyncStorage.setItem(ONBOARD_KEY, "1");
  }

  function handleRemove(saved: SavedRecipe) {
    Alert.alert("Delete recipe", `Delete “${saved.title}” from your collection?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await removeSavedRecipe(saved.id);
            setSavedRecipes((current) => current.filter((item) => item.id !== saved.id));
            setRemovedRecipe(saved);
            if (recipe && recipeKey(recipe) === recipeKey(saved)) {
              setView("home");
              setRecipe(null);
              setCookOpen(false);
            }
          })();
        },
      },
    ]);
  }

  async function handleUndoRemove() {
    if (!removedRecipe) return;
    upsertSaved(await saveRecipe(removedRecipe));
    setRemovedRecipe(null);
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
          <Image source={require("./assets/owl-logo.png")} style={styles.brandMark} />
          <Text style={styles.brandText}>RecipeGuru</Text>
        </Pressable>
        <View style={styles.topActions}>
          <Pressable
            style={styles.ghost}
            onPress={() => {
              setView("home");
              setCookOpen(false);
              setError(null);
            }}
          >
            <Text style={styles.ghostText}>Week {weekly.length}</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => setGroceryOpen(true)}>
            <Text style={styles.ghostText}>
              Grocery {grocery.filter((item) => !item.checked).length}
            </Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => setHelpOpen(true)}>
            <Text style={styles.ghostText}>Help</Text>
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
          <Text style={styles.libraryMeta}>
            Reels often block a direct clip. If Extract fails, switch to Caption text and
            paste the ingredients and steps. You can also share a link into RecipeGuru.
          </Text>
          <Pressable style={styles.ghost} onPress={() => void openSample()}>
            <Text style={styles.ghostText}>Try a sample recipe</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Weekly meals</Text>
          <Text style={styles.libraryMeta}>
            Add a clipped recipe or an easy meal. It goes on the grocery list too.
          </Text>
          <Text style={styles.libraryMeta}>Easy meal</Text>
          <TextInput
            style={styles.search}
            value={weeklyTitle}
            onChangeText={setWeeklyTitle}
            onSubmitEditing={() => void handleAddWeeklyCustom()}
          />
          <Text style={[styles.libraryMeta, { marginTop: 8 }]}>Need from the store</Text>
          <TextInput
            style={styles.search}
            value={weeklyShop}
            onChangeText={setWeeklyShop}
          />
          <Pressable
            style={[styles.primary, !weeklyTitle.trim() && styles.disabled]}
            disabled={!weeklyTitle.trim()}
            onPress={() => void handleAddWeeklyCustom()}
          >
            <Text style={styles.primaryText}>Add meal</Text>
          </Pressable>
          {weekly.length === 0 ? (
            <Text style={styles.libraryMeta}>Nothing planned yet.</Text>
          ) : (
            sortWeeklyMeals(weekly).map((meal) => {
              const linked = meal.recipeId
                ? savedRecipes.find((item) => item.id === meal.recipeId)
                : undefined;
              return (
                <View key={meal.id} style={styles.weeklyRow}>
                  <Pressable onPress={() => void handleToggleWeekly(meal, !meal.checked)}>
                    <Check checked={meal.checked} />
                  </Pressable>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (!linked) {
                        void handleToggleWeekly(meal, !meal.checked);
                        return;
                      }
                      setRecipe(linked);
                      setUrl(linked.sourceUrl);
                      setCheckedIngredients(new Set());
                      setDoneSteps(new Set());
                      setView("recipe");
                    }}
                  >
                    <Text
                      style={[
                        styles.libraryName,
                        meal.checked ? { textDecorationLine: "line-through", opacity: 0.55 } : null,
                      ]}
                    >
                      {meal.title}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => void handleRemoveWeekly(meal)}>
                    <Text style={styles.groceryRemove}>Remove</Text>
                  </Pressable>
                </View>
              );
            })
          )}
          {weekly.length ? (
            <Pressable style={styles.ghost} onPress={() => void clearWeeklyMeals().then(setWeekly)}>
              <Text style={styles.ghostText}>Clear week</Text>
            </Pressable>
          ) : null}
          <Text style={styles.sectionTitle}>Saved recipes</Text>
          <TextInput
            style={styles.search}
            value={libraryQuery}
            onChangeText={setLibraryQuery}
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
            {RECIPE_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                style={[styles.chip, libraryFilter === category && styles.chipOn]}
                onPress={() => setLibraryFilter(category)}
              >
                <Text style={styles.chipText}>
                  {recipeCategoryLabel(category)}{" "}
                  {savedRecipes.filter((item) => recipeMatchesCategory(item, category)).length}
                </Text>
              </Pressable>
            ))}
          </View>
          {savedRecipes
            .filter((item) => {
              if (libraryFilter === "favorites") return item.favorite;
              if (libraryFilter !== "all") return recipeMatchesCategory(item, libraryFilter);
              return true;
            })
            .filter((item) => matchesQuery(item, libraryQuery))
            .map((item) => (
              <View key={item.id} style={styles.libraryCard}>
                <View style={styles.libraryCardRow}>
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
                      {item.categories.length
                        ? ` · ${item.categories.map(recipeCategoryLabel).join(", ")}`
                        : ""}
                      {item.tags.length ? ` · ${item.tags.join(", ")}` : ""}
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => void handleFavorite(item)}>
                  <Text style={styles.chipText}>{item.favorite ? "★" : "☆"}</Text>
                </Pressable>
                </View>
                <View style={styles.libraryActions}>
                  <Pressable style={styles.ghost} onPress={() => void handleAddWeeklyRecipe(item)}>
                    <Text style={styles.ghostText}>
                      {weekRecipeIds.has(item.id) ? "On week" : "Week"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.ghost} onPress={() => void handleShopRecipe(item)}>
                    <Text style={styles.ghostText}>Shop</Text>
                  </Pressable>
                  <Pressable style={styles.ghost} onPress={() => handleRemove(item)}>
                    <Text style={styles.ghostText}>Delete</Text>
                  </Pressable>
                </View>
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
            <Pressable style={styles.ghost} onPress={() => void handleWeeklyFromRecipe()}>
              <Text style={styles.ghostText}>
                {savedMatch && weekRecipeIds.has(savedMatch.id) ? "On this week" : "This week"}
              </Text>
            </Pressable>
            {savedMatch ? (
              <Pressable style={styles.ghost} onPress={() => handleRemove(savedMatch)}>
                <Text style={styles.ghostText}>Delete</Text>
              </Pressable>
            ) : null}
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
            <Text style={styles.panelTitle}>Meal</Text>
            <View style={styles.chips}>
              {RECIPE_CATEGORIES.map((category) => {
                const on = (savedMatch?.categories ?? []).includes(category);
                return (
                  <Pressable
                    key={category}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() =>
                      void persistPatch({
                        categories: toggleRecipeCategory(savedMatch?.categories, category),
                      })
                    }
                  >
                    <Text style={styles.chipText}>{recipeCategoryLabel(category)}</Text>
                  </Pressable>
                );
              })}
            </View>
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
            <Text style={styles.loadingText}>{loadingHint}</Text>
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
        visible={helpOpen}
        animationType="slide"
        transparent
        onRequestClose={dismissHelp}
      >
        <SafeAreaView style={styles.groceryWrap} edges={["bottom", "left", "right"]}>
          <View style={styles.groceryCard}>
            <Text style={styles.panelTitle}>How to test RecipeGuru</Text>
            <Text style={styles.groceryHint}>
              1. Try the sample recipe, then Save, This week, Grocery, and Cook.
            </Text>
            <Text style={styles.groceryHint}>
              2. Paste a public recipe blog URL and tap Extract.
            </Text>
            <Text style={styles.groceryHint}>
              3. For TikTok or Instagram, paste the URL. If it fails, copy the caption
              and use Caption text.
            </Text>
            <Text style={styles.groceryHint}>
              4. Recipes stay on this phone. Export a backup before you uninstall.
            </Text>
            <Pressable style={styles.primary} onPress={() => void openSample()}>
              <Text style={styles.primaryText}>Try a sample recipe</Text>
            </Pressable>
            <Pressable style={styles.groceryGhost} onPress={() => void handleExportKitchen()}>
              <Text style={styles.groceryGhostText}>Export backup</Text>
            </Pressable>
            <Pressable style={styles.groceryGhost} onPress={() => void handleImportKitchen()}>
              <Text style={styles.groceryGhostText}>Restore backup from clipboard</Text>
            </Pressable>
            <Pressable style={styles.groceryGhost} onPress={handleReport}>
              <Text style={styles.groceryGhostText}>Report a problem</Text>
            </Pressable>
            <Pressable
              style={styles.groceryGhost}
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            >
              <Text style={styles.groceryGhostText}>Privacy policy</Text>
            </Pressable>
            <Pressable
              style={styles.groceryGhost}
              onPress={() => void Linking.openURL(TESTERS_URL)}
            >
              <Text style={styles.groceryGhostText}>Tester notes</Text>
            </Pressable>
            <Text style={styles.groceryHint}>
              Household unlock — you and your partner. Testers stay on the clip limit.
            </Text>
            <TextInput
              style={styles.groceryAddInput}
              value={householdKey}
              onChangeText={(value) => {
                setHouseholdKey(value);
                setHouseholdSaved(false);
              }}
              placeholder="Unlock code"
              placeholderTextColor="#8a7b6b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={styles.groceryGhost}
              onPress={() => {
                void saveHouseholdKey(householdKey).then((value) => {
                  setHouseholdKey(value);
                  setHouseholdSaved(true);
                });
              }}
            >
              <Text style={styles.groceryGhostText}>
                {householdSaved
                  ? householdKey.trim()
                    ? "Unlimited clips on this phone"
                    : "Unlock cleared"
                  : "Save unlock"}
              </Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={dismissHelp}>
              <Text style={styles.primaryText}>Got it</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={groceryOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGroceryOpen(false)}
      >
        <SafeAreaView style={styles.groceryWrap} edges={["bottom", "left", "right"]}>
          <View style={styles.groceryCard}>
            <Text style={styles.panelTitle}>Grocery list</Text>
            <View style={styles.groceryAdd}>
              <TextInput
                style={styles.groceryAddInput}
                value={groceryDraft}
                onChangeText={setGroceryDraft}
                placeholder="Milk, 2 limes, olive oil…"
                placeholderTextColor="#8a7b6b"
                returnKeyType="done"
                onSubmitEditing={() => void handleAddGroceryLine()}
              />
              <Pressable
                style={[styles.ghost, !groceryDraft.trim() && styles.disabled]}
                disabled={!groceryDraft.trim()}
                onPress={() => void handleAddGroceryLine()}
              >
                <Text style={styles.ghostText}>Add</Text>
              </Pressable>
            </View>
            <ScrollView
              style={[styles.groceryList, { maxHeight: Math.round(windowHeight * 0.52) }]}
              contentContainerStyle={styles.groceryListContent}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable onPress={() => setArrangeAisles((value) => !value)}>
                <Text style={styles.groceryHint}>
                  {arrangeAisles ? "Hide aisle order" : "Arrange aisles"}
                </Text>
              </Pressable>
              {arrangeAisles
                ? categoryOrder.map((category, index) => (
                    <View key={category} style={styles.groceryArrangeRow}>
                      <Text style={styles.checkLabel}>{groceryCategoryLabel(category)}</Text>
                      <Pressable
                        disabled={index === 0}
                        onPress={() => {
                          const next = moveCategoryOrder(categoryOrder, category, -1, categoryOrder);
                          void setGroceryCategoryOrder(next).then(setCategoryOrder);
                        }}
                      >
                        <Text style={[styles.groceryMoveBtn, index === 0 && styles.disabled]}>↑</Text>
                      </Pressable>
                      <Pressable
                        disabled={index === categoryOrder.length - 1}
                        onPress={() => {
                          const next = moveCategoryOrder(categoryOrder, category, 1, categoryOrder);
                          void setGroceryCategoryOrder(next).then(setCategoryOrder);
                        }}
                      >
                        <Text
                          style={[
                            styles.groceryMoveBtn,
                            index === categoryOrder.length - 1 && styles.disabled,
                          ]}
                        >
                          ↓
                        </Text>
                      </Pressable>
                    </View>
                  ))
                : null}
              {grocery.length === 0 ? (
                <Text style={styles.libraryMeta}>
                  Add items above, or open a recipe and tap Grocery.
                </Text>
              ) : (
                <>
                  <Text style={styles.groceryHint}>
                    Tap an aisle name to move an item. Use arrows to reorder aisles.
                  </Text>
                  {groceryGroups.map((group, index) => (
                    <View key={group.category}>
                      <View style={styles.groceryArrangeRow}>
                        <Text
                          style={[
                            styles.groceryGroupTitle,
                            { marginTop: 0, flex: 1 },
                          ]}
                        >
                          {group.label}
                        </Text>
                        <Pressable
                          disabled={index === 0}
                          onPress={() => {
                            const visible = groceryGroups.map((row) => row.category);
                            const next = moveCategoryOrder(
                              categoryOrder,
                              group.category,
                              -1,
                              visible,
                            );
                            void setGroceryCategoryOrder(next).then(setCategoryOrder);
                          }}
                        >
                          <Text style={[styles.groceryMoveBtn, index === 0 && styles.disabled]}>
                            ↑
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={index === groceryGroups.length - 1}
                          onPress={() => {
                            const visible = groceryGroups.map((row) => row.category);
                            const next = moveCategoryOrder(
                              categoryOrder,
                              group.category,
                              1,
                              visible,
                            );
                            void setGroceryCategoryOrder(next).then(setCategoryOrder);
                          }}
                        >
                          <Text
                            style={[
                              styles.groceryMoveBtn,
                              index === groceryGroups.length - 1 && styles.disabled,
                            ]}
                          >
                            ↓
                          </Text>
                        </Pressable>
                      </View>
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
                          <Pressable onPress={() => setAssigningItem(item)}>
                            <Text style={styles.groceryCatChip}>
                              {groceryCategoryLabel(itemGroceryCategory(item))}
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
            <View style={styles.groceryToolbar}>
              <Pressable
                style={[styles.groceryGhost, !grocery.length && styles.disabled]}
                disabled={!grocery.length}
                onPress={() => {
                  const allChecked = grocery.length > 0 && grocery.every((item) => item.checked);
                  void setAllGroceryChecked(!allChecked).then(setGrocery);
                }}
              >
                <Text style={styles.groceryGhostText}>
                  {grocery.length > 0 && grocery.every((item) => item.checked)
                    ? "Uncheck all"
                    : "Check all"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.groceryGhost,
                  !grocery.some((item) => item.checked) && styles.disabled,
                ]}
                disabled={!grocery.some((item) => item.checked)}
                onPress={() => void clearCheckedGrocery().then(setGrocery)}
              >
                <Text style={styles.groceryGhostText}>Clear checked</Text>
              </Pressable>
              <Pressable
                style={[styles.groceryGhost, !grocery.length && styles.disabled]}
                disabled={!grocery.length}
                onPress={() => void clearAllGrocery().then(setGrocery)}
              >
                <Text style={styles.groceryGhostText}>Clear all</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.primary}
              onPress={() => {
                setAssigningItem(null);
                setGroceryOpen(false);
              }}
            >
              <Text style={styles.primaryText}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={Boolean(assigningItem)}
        animationType="fade"
        transparent
        onRequestClose={() => setAssigningItem(null)}
      >
        <Pressable style={styles.groceryWrap} onPress={() => setAssigningItem(null)}>
          <View style={styles.groceryCard}>
            <Text style={styles.panelTitle}>Move to aisle</Text>
            <Text style={styles.groceryHint}>
              {assigningItem ? assigningItem.label : ""}
            </Text>
            {categoryOrder.map((category) => {
              const selected =
                assigningItem != null && itemGroceryCategory(assigningItem) === category;
              return (
                <Pressable
                  key={category}
                  style={[styles.groceryAssignRow, selected && styles.groceryAssignOn]}
                  onPress={() => {
                    if (!assigningItem) return;
                    const id = assigningItem.id;
                    setAssigningItem(null);
                    void setGroceryItemCategory(id, category).then((updated) => {
                      setGrocery((current) =>
                        current.map((row) => (row.id === updated.id ? updated : row)),
                      );
                    });
                  }}
                >
                  <Text style={styles.checkLabel}>{groceryCategoryLabel(category)}</Text>
                  {selected ? <Text style={styles.groceryRemove}>Current</Text> : null}
                </Pressable>
              );
            })}
            <Pressable style={styles.groceryGhost} onPress={() => setAssigningItem(null)}>
              <Text style={styles.groceryGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {removedRecipe ? (
        <View style={styles.undoToast}>
          <Text style={styles.undoToastText} numberOfLines={1}>
            Deleted “{removedRecipe.title}”.
          </Text>
          <Pressable onPress={() => void handleUndoRemove()}>
            <Text style={styles.undoToastAction}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
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
    backgroundColor: "#0E1519",
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
  weeklyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#172126",
    borderColor: "rgba(247,243,235,0.1)",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  libraryCard: {
    gap: 8,
    backgroundColor: "#172126",
    borderColor: "rgba(247,243,235,0.1)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 8,
  },
  libraryCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  libraryActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4, paddingBottom: 2 },
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
  groceryHint: { color: "#5c6a62", fontSize: 13, marginBottom: 4, fontWeight: "600" },
  groceryArrangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  groceryMoveBtn: {
    color: "#142018",
    fontSize: 16,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "rgba(20,32,24,0.14)",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groceryToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groceryAssignRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  groceryAssignOn: { backgroundColor: "rgba(255,90,60,0.12)" },
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
  groceryAdd: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
  groceryAddInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(20,32,24,0.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#142018",
    backgroundColor: "#fffaf2",
  },
  undoToast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#f4f0ea",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(63,74,58,0.18)",
  },
  undoToastText: { flex: 1, color: "#1c3d5c" },
  undoToastAction: { color: "#3f4a3a", fontWeight: "700" },
  groceryGhost: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "rgba(20,32,24,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groceryGhostText: { color: "#142018", fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.45 },
});
