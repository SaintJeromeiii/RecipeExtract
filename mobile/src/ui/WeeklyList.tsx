import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Card from "./Card";
import Button from "./Button";
import { colors } from "./tokens";

export default function WeeklyList(props: any) {
  const {
    weekly,
    weeklyTitle,
    setWeeklyTitle,
    handleAddWeeklyCustom,
    handleToggleWeekly,
    handleRemoveWeekly,
    clearWeeklyMeals,
    savedRecipes,
    sortWeeklyMeals,
  } = props;

  return (
    <>
      <Text style={props.styles.sectionTitle}>Weekly meals</Text>
      <Text style={props.styles.libraryMeta}>Add a clipped recipe or an easy meal. It goes on the grocery list too.</Text>
      <Text style={props.styles.libraryMeta}>Easy meal</Text>
      <TextInput style={props.styles.search} value={weeklyTitle} onChangeText={setWeeklyTitle} onSubmitEditing={() => void handleAddWeeklyCustom()} />
      <Button variant="primary" onPress={() => void handleAddWeeklyCustom()} disabled={!weeklyTitle.trim()}>
        Add meal
      </Button>
      {weekly.length === 0 ? (
        <Text style={props.styles.libraryMeta}>Nothing planned yet.</Text>
      ) : (
        sortWeeklyMeals(weekly).map((meal: any) => {
          const linked = meal.recipeId ? savedRecipes.find((item: any) => item.id === meal.recipeId) : undefined;
          const title = (meal.title || linked?.title || "").trim();
          return (
            <Card key={meal.id} style={styles.mealCard}>
              <Pressable onPress={() => void handleToggleWeekly(meal, !meal.checked)}>
                <props.Check checked={meal.checked} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                {linked ? (
                  <Pressable onPress={() => props.onOpenRecipe?.(linked)}>
                    <Text style={[styles.mealTitle, styles.mealTitleLink]}>{title || "Untitled meal"}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.mealTitle}>{title || "Untitled meal"}</Text>
                )}
              </View>
              <Button onPress={() => void handleRemoveWeekly(meal)} style={{ marginLeft: 8 }}>
                Remove
              </Button>
            </Card>
          );
        })
      )}
      {weekly.length ? (
        <Pressable style={props.styles.ghost} onPress={() => void clearWeeklyMeals().then((r: any) => props.setWeekly(r))}>
          <Text style={props.styles.ghostText}>Clear week</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  mealCard: { flexDirection: "row", alignItems: "center" },
  mealTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  mealTitleLink: { color: colors.brandDark, textDecorationLine: "underline" },
});
