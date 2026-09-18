import React from "react";
import { Pressable, Text, StyleSheet, Animated } from "react-native";
import { colors, radii, spacing } from "./tokens";

export default function Button({ children, onPress, style, variant = "primary", disabled }: any) {
  const scale = React.useRef(new Animated.Value(1)).current;
  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }

  const bg = variant === "primary" ? colors.brand : "transparent";
  const color = variant === "primary" ? colors.surface : colors.text;
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
        style={[styles.btn, { backgroundColor: bg }, border, style, disabled && styles.disabled]}
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
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
