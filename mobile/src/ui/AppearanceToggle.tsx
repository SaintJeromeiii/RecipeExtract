import { Switch, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./Theme";
import { type } from "./tokens";

export default function AppearanceToggle() {
  const { appearance, colors, setAppearance } = useTheme();
  const dark = appearance === "dark";

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>Dark mode</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          {dark ? "On — charcoal pages, cream type." : "Off — cream pages, ink type."}
        </Text>
      </View>
      <Switch
        value={dark}
        onValueChange={(on) => setAppearance(on ? "dark" : "cream")}
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
