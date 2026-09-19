import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WEEKDAYS, weekdayLabel } from "../../../shared/weekly";
import type { Weekday } from "../types";
import { colors, radii, spacing } from "./tokens";

export default function WeekdayPicker({
  visible,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  onPick: (day: Weekday | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.heading}>When are you cooking this?</Text>
          <Text style={styles.meal} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.chips}>
            <Pressable style={styles.chip} onPress={() => onPick(null)}>
              <Text style={styles.chipText}>Anytime</Text>
            </Pressable>
            {WEEKDAYS.map((day) => (
              <Pressable key={day} style={styles.chip} onPress={() => onPick(day)}>
                <Text style={styles.chipText}>{weekdayLabel(day)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(8,12,14,0.72)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 12,
  },
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  meal: { color: colors.muted, fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { color: colors.text, fontWeight: "700" },
  cancel: { color: colors.brandDark, fontWeight: "700", marginTop: 4 },
});
