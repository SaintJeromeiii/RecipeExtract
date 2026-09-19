import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Card from "./Card";
import Button from "./Button";
import WeekdayPlanToggle from "./WeekdayPlanToggle";
import { colors } from "./tokens";
import { WEEKDAYS, groupWeeklyMeals, sortWeeklyMeals, weekdayLabel } from "../../../shared/weekly";
import type { Weekday } from "../types";

export default function WeeklyList(props: any) {
  const {
    weekly,
    weeklyTitle,
    setWeeklyTitle,
    handleAddWeeklyCustom,
    handleToggleWeekly,
    handleRemoveWeekly,
    handleSetWeeklyDay,
    clearWeeklyMeals,
    savedRecipes,
    assignWeekdays,
    onAssignWeekdays,
  } = props;
  const [newDay, setNewDay] = useState<Weekday | null>(null);
  const groups = assignWeekdays ? groupWeeklyMeals(weekly) : [{ key: "all", label: "", meals: sortWeeklyMeals(weekly) }];

  return (
    <>
      <Text style={props.styles.sectionTitle}>Weekly meals</Text>
      <Text style={props.styles.libraryMeta}>
        Add a clipped recipe or an easy meal. It goes on the grocery list too.
      </Text>
      <WeekdayPlanToggle value={assignWeekdays} onChange={onAssignWeekdays} />
      <Text style={props.styles.libraryMeta}>Easy meal</Text>
      <TextInput
        style={props.styles.search}
        value={weeklyTitle}
        onChangeText={setWeeklyTitle}
        onSubmitEditing={() => void handleAddWeeklyCustom(assignWeekdays ? newDay : null)}
      />
      {assignWeekdays ? (
        <View style={styles.dayRow}>
          <Pressable
            style={[styles.dayChip, newDay === null && styles.dayChipOn]}
            onPress={() => setNewDay(null)}
          >
            <Text style={[styles.dayChipText, newDay === null && styles.dayChipTextOn]}>Anytime</Text>
          </Pressable>
          {WEEKDAYS.map((day) => (
            <Pressable
              key={day}
              style={[styles.dayChip, newDay === day && styles.dayChipOn]}
              onPress={() => setNewDay(day)}
            >
              <Text style={[styles.dayChipText, newDay === day && styles.dayChipTextOn]}>
                {weekdayLabel(day)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button
        variant="primary"
        onPress={() => void handleAddWeeklyCustom(assignWeekdays ? newDay : null)}
        disabled={!weeklyTitle.trim()}
      >
        Add meal
      </Button>
      {weekly.length === 0 ? (
        <Text style={props.styles.libraryMeta}>Nothing planned yet.</Text>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            {group.label ? <Text style={styles.groupLabel}>{group.label}</Text> : null}
            {group.meals.map((meal: any) => {
              const linked = meal.recipeId
                ? savedRecipes.find((item: any) => item.id === meal.recipeId)
                : undefined;
              const title = (meal.title || linked?.title || "").trim();
              return (
                <Card key={meal.id} style={styles.mealCard}>
                  <Pressable onPress={() => void handleToggleWeekly(meal, !meal.checked)}>
                    <props.Check checked={meal.checked} />
                  </Pressable>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    {linked ? (
                      <Pressable onPress={() => props.onOpenRecipe?.(linked)}>
                        <Text style={[styles.mealTitle, styles.mealTitleLink]}>
                          {title || "Untitled meal"}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.mealTitle}>{title || "Untitled meal"}</Text>
                    )}
                    {assignWeekdays ? (
                    <View style={styles.dayRow}>
                      <Pressable
                        style={[styles.miniChip, meal.weekday == null && styles.miniChipOn]}
                        onPress={() => void handleSetWeeklyDay(meal, null)}
                      >
                        <Text style={styles.miniChipText}>Any</Text>
                      </Pressable>
                      {WEEKDAYS.map((day) => (
                        <Pressable
                          key={day}
                          style={[styles.miniChip, meal.weekday === day && styles.miniChipOn]}
                          onPress={() => void handleSetWeeklyDay(meal, day)}
                        >
                          <Text style={styles.miniChipText}>{weekdayLabel(day)}</Text>
                        </Pressable>
                      ))}
                    </View>
                    ) : null}
                  </View>
                  <Button onPress={() => void handleRemoveWeekly(meal)} style={{ marginLeft: 8 }}>
                    Remove
                  </Button>
                </Card>
              );
            })}
          </View>
        ))
      )}
      {weekly.length ? (
        <Pressable
          style={props.styles.ghost}
          onPress={() => void clearWeeklyMeals().then((r: any) => props.setWeekly(r))}
        >
          <Text style={props.styles.ghostText}>Clear week</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, marginTop: 8 },
  groupLabel: {
    color: colors.chromeText,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 8,
  },
  mealCard: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12 },
  mealTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  mealTitleLink: { color: colors.brandDark, textDecorationLine: "underline" },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  dayChip: {
    borderWidth: 1,
    borderColor: "rgba(247,243,235,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dayChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayChipText: { color: colors.chromeText, fontSize: 12, fontWeight: "700" },
  dayChipTextOn: { color: colors.surface },
  miniChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  miniChipOn: { backgroundColor: colors.brandSoft, borderColor: colors.brandLine },
  miniChipText: { color: colors.text, fontSize: 11, fontWeight: "700" },
});
