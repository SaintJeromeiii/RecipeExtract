import { Switch, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./Theme";
import { type } from "./tokens";

export default function WeekdayPlanToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  tone?: "dark" | "light";
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>Assign days</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          {value
            ? "On — pick a weekday when you add a meal."
            : "Off — meals go on the weekly list with no day."}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brand }}
        thumbColor={colors.onBrand}
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
  title: { fontWeight: "700", fontSize: 15 },
  hint: { marginTop: 4, fontSize: type.caption, lineHeight: 18 },
});
