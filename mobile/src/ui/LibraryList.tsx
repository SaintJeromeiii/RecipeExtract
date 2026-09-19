import React from "react";
import { View, Text, Image, Pressable, TextInput } from "react-native";
import Card from "./Card";
import Button from "./Button";
import { colors } from "./tokens";
import { weekdayLabel } from "../../../shared/weekly";

export default function LibraryList(props: any) {
  const {
    savedRecipes,
    libraryQuery,
    setLibraryQuery,
    libraryFilter,
    setLibraryFilter,
    RECIPE_CATEGORIES,
    recipeCategoryLabel,
    recipeMatchesCategory,
    matchesQuery,
    handleFavorite,
    handleToggleWeeklyRecipe,
    handleShopRecipe,
    handleRemove,
    weekRecipeIds,
    weekByRecipe,
    assignWeekdays,
    setRecipe,
    setUrl,
    setCheckedIngredients,
    setDoneSteps,
    setView,
  } = props;

  return (
    <>
      <Text style={props.styles.sectionTitle}>Saved recipes</Text>
      <TextInput style={props.styles.search} value={libraryQuery} onChangeText={setLibraryQuery} />
      <View style={props.styles.chips}>
        <Pressable style={[props.styles.chip, libraryFilter === "all" && props.styles.chipOn]} onPress={() => setLibraryFilter("all")}>
          <Text style={props.styles.chipText}>All {savedRecipes.length}</Text>
        </Pressable>
        <Pressable style={[props.styles.chip, libraryFilter === "favorites" && props.styles.chipOn]} onPress={() => setLibraryFilter("favorites")}>
          <Text style={props.styles.chipText}>Favorites {savedRecipes.filter((item: any) => item.favorite).length}</Text>
        </Pressable>
        {RECIPE_CATEGORIES.map((category: any) => (
          <Pressable key={category} style={[props.styles.chip, libraryFilter === category && props.styles.chipOn]} onPress={() => setLibraryFilter(category)}>
            <Text style={props.styles.chipText}>{recipeCategoryLabel(category)} {savedRecipes.filter((item: any) => recipeMatchesCategory(item, category)).length}</Text>
          </Pressable>
        ))}
      </View>
      {savedRecipes.filter((item: any) => {
        if (libraryFilter === "favorites") return item.favorite;
        if (libraryFilter !== "all") return recipeMatchesCategory(item, libraryFilter);
        return true;
      })
      .filter((item: any) => matchesQuery(item, libraryQuery))
      .map((item: any) => (
        <Card key={item.id} style={{ padding: 12 }}>
          <View style={props.styles.libraryCardRow}>
            <Pressable style={props.styles.libraryOpen} onPress={() => { if (props.onOpenRecipe) props.onOpenRecipe(item); else { setRecipe(item); setUrl(item.sourceUrl); setCheckedIngredients(new Set()); setDoneSteps(new Set()); setView("recipe"); } }}>
              {item.image ? <Image source={{ uri: item.image }} style={props.styles.libraryImage} /> : <View style={props.styles.libraryImage}><Text style={props.styles.brandMarkText}>R</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>{item.sourceName ?? "Saved"}{item.categories.length ? ` · ${item.categories.map(recipeCategoryLabel).join(", ")}` : ""}{item.tags.length ? ` · ${item.tags.join(", ")}` : ""}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => void handleFavorite(item)}>
              <Text style={props.styles.chipText}>{item.favorite ? "★" : "☆"}</Text>
            </Pressable>
          </View>
          <View style={[props.styles.libraryActions, { marginTop: 8 }]}> 
            <Button
              onPress={() => void handleToggleWeeklyRecipe(item)}
              style={{ marginRight: 8 }}
            >
              {weekRecipeIds.has(item.id)
                ? assignWeekdays && weekByRecipe?.[item.id]
                  ? `On ${weekdayLabel(weekByRecipe[item.id])}`
                  : "On week"
                : "Week"}
            </Button>
            <Button onPress={() => void handleShopRecipe(item)} style={{ marginRight: 8 }} variant="secondary">Shop</Button>
            <Button onPress={() => handleRemove(item)} variant="secondary">Delete</Button>
          </View>
        </Card>
      ))}
    </>
  );
}
