import React from "react";
import { Pressable, Text, StyleSheet, Animated } from "react-native";
import { useTheme } from "./Theme";
import { radii, spacing } from "./tokens";

export default function Button({ children, onPress, style, variant = "primary", disabled }: any) {
  const { colors } = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;
  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }

  const bg = variant === "primary" ? colors.brand : "transparent";
  const color = variant === "primary" ? colors.onBrand : colors.text;
  const border =
    variant === "secondary"
      ? { borderWidth: 1, borderColor: colors.border, elevation: 0, shadowOpacity: 0 }
      : null;

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[styles.btn, { backgroundColor: bg, shadowColor: colors.text }, border, style, disabled && styles.disabled]}
        disabled={disabled}
      >
        <Text style={[styles.text, { color }]}>{children}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
