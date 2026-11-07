import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "./Theme";
import { radii, spacing } from "./tokens";

export default function Card({ children, style }: any) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.text }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
