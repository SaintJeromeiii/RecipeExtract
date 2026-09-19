import { Switch, StyleSheet, Text, View } from "react-native";
import { colors } from "./tokens";

export default function WeekdayPlanToggle({
  value,
  onChange,
  tone = "dark",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, light && styles.titleLight]}>Assign days</Text>
        <Text style={[styles.hint, light && styles.hintLight]}>
          {value
            ? "On — pick a weekday when you add a meal."
            : "Off — meals go on the weekly list with no day."}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#3a4044", true: colors.brand }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.chromeText, fontWeight: "700", fontSize: 15 },
  titleLight: { color: "#142018" },
  hint: { color: colors.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  hintLight: { color: "#5c6a62" },
});
