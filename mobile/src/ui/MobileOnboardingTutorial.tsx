import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "./Button";
import Card from "./Card";
import { colors, fonts, radii, spacing } from "./tokens";

const STEPS = [
  {
    eyebrow: "Welcome",
    title: "Skip the blog. Keep the recipe.",
    body: "Paste a recipe URL and Pluck pulls the title, ingredients, and steps — ready to cook.",
  },
  {
    eyebrow: "Clip",
    title: "Blogs, Reels, and TikTok",
    body: "Paste a public recipe link and tap Extract. If a social video has a thin caption, switch to Caption and paste the ingredients and steps yourself.",
  },
  {
    eyebrow: "This week",
    title: "Plan meals in one list",
    body: "Add a clipped recipe or an easy meal that doesn’t need a recipe. Checking it off keeps the week moving.",
  },
  {
    eyebrow: "Market",
    title: "Groceries fill in automatically",
    body: "Meals you add to the week go on the grocery list. Shop by aisle, check items off, and clear what’s done.",
  },
  {
    eyebrow: "Kitchen",
    title: "Cook step by step",
    body: "Open a recipe, tap Start cooking, and swipe through steps. The screen stays awake so you aren’t unlocking floury fingers.",
  },
] as const;

type Props = {
  visible: boolean;
  onComplete: () => void;
};

export default function MobileOnboardingTutorial({ visible, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const last = index >= STEPS.length - 1;
  const step = STEPS[index] ?? STEPS[0];

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  function goNext() {
    if (last) onComplete();
    else setIndex((current) => current + 1);
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onComplete}
    >
      <View style={styles.scrim}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          <Card style={styles.card}>
            <Text style={styles.eyebrow}>{step.eyebrow}</Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.dots} accessibilityRole="progressbar">
              {STEPS.map((item, dotIndex) => (
                <View
                  key={item.title}
                  style={[styles.dot, dotIndex === index && styles.dotOn]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <View style={styles.actionSlot}>
                {!last ? (
                  <Button variant="secondary" onPress={onComplete} style={styles.actionBtn}>
                    Skip
                  </Button>
                ) : null}
              </View>
              <View style={styles.actionSlot}>
                <Button variant="primary" onPress={goNext} style={styles.actionBtn}>
                  {last ? "Get started" : "Next"}
                </Button>
              </View>
            </View>
          </Card>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(8, 16, 24, 0.55)",
  },
  safe: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  card: {
    marginVertical: 0,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.brand,
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 32,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  dotOn: {
    width: 22,
    backgroundColor: colors.brand,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  actionSlot: {
    flex: 1,
  },
  actionBtn: {
    width: "100%",
  },
});
