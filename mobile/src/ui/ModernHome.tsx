import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Image, Animated } from "react-native";
import { colors, spacing, radii, fonts } from "./tokens";
import Card from "./Card";
import Button from "./Button";

type Props = {
  inputMode: "url" | "caption";
  setInputMode: (m: "url" | "caption") => void;
  url: string;
  setUrl: (s: string) => void;
  captionText: string;
  setCaptionText: (s: string) => void;
  extract: () => Promise<void> | void;
  extractCaption: () => Promise<void> | void;
  loading: boolean;
  error: string | null;
  openSample: () => void;
};

export default function ModernHome({
  inputMode,
  setInputMode,
  url,
  setUrl,
  captionText,
  setCaptionText,
  extract,
  extractCaption,
  loading,
  error,
  openSample,
}: Props) {
  const scale = React.useRef(new Animated.Value(1)).current;
  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={require("../../assets/owl-logo.png")} style={styles.heroLogo} />
        <Text style={styles.heroTitle}>Pluck</Text>
        <Text style={styles.heroSubtitle}>Skip the blog. Keep the recipe.</Text>
      </View>

      <Card style={styles.composerCard}>
        <Text style={styles.title}>Drop a ripe link or caption</Text>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, inputMode === "url" && styles.modeBtnOn]}
          onPress={() => setInputMode("url")}
        >
          <Text style={[styles.modeText, inputMode === "url" && styles.modeTextOn]}>URL</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, inputMode === "caption" && styles.modeBtnOn]}
          onPress={() => setInputMode("caption")}
        >
          <Text style={[styles.modeText, inputMode === "caption" && styles.modeTextOn]}>Caption</Text>
        </Pressable>
      </View>

      {inputMode === "url" ? (
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="Recipe blog, Facebook Reel, TikTok…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={() => void extract()}
        />
      ) : (
        <TextInput
          value={captionText}
          onChangeText={setCaptionText}
          placeholder={"Ingredients:\n1 cup flour\n...\n\nInstructions:\n1. Mix..."}
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.caption]}
        />
      )}

        <View style={styles.row}> 
          <Pressable style={styles.ghost} onPress={() => { if (inputMode === 'url') setUrl(''); else setCaptionText(''); }}>
            <Text style={styles.ghostText}>Clear</Text>
          </Pressable>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Button variant="primary" onPress={() => void (inputMode === "url" ? extract() : extractCaption())} disabled={(inputMode === "url" ? !url : !captionText) || loading}>
              {loading ? "Extracting…" : "Extract"}
            </Button>
          </Animated.View>
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.meta}>If Extract fails, switch to caption text and paste ingredients + steps.</Text>
      <Pressable style={styles.link} onPress={() => openSample()}>
        <Text style={styles.linkText}>Try a sample recipe</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  hero: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLogo: { width: 96, height: 96, borderRadius: radii.md, marginBottom: 8 },
  heroTitle: { fontSize: 26, color: colors.text, fontWeight: "700", fontFamily: fonts.heading },
  heroSubtitle: { color: colors.muted, marginTop: 6 },
  composerCard: { paddingTop: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 8 },
  logo: { width: 36, height: 36, marginRight: 8, borderRadius: radii.sm },
  eyebrow: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  title: { fontSize: 22, color: colors.text, fontWeight: "700", marginBottom: 12 },
  modeRow: { flexDirection: "row", marginBottom: 10 },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.sm, backgroundColor: colors.border, marginRight: 8 },
  modeBtnOn: { backgroundColor: colors.brand },
  modeText: { color: colors.text },
  modeTextOn: { color: "white" },
  input: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  caption: { height: 100 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ghost: { paddingVertical: 10, paddingHorizontal: 14 },
  ghostText: { color: colors.text },
  primary: { backgroundColor: colors.brand, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radii.md },
  primaryText: { color: colors.surface, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  error: { color: colors.error, marginTop: 8, marginBottom: 8 },
  meta: { color: colors.muted, marginTop: 6 },
  link: { marginTop: 8 },
  linkText: { color: colors.brand },
});
