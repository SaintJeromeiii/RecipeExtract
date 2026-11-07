import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "./Button";
import { IconLink } from "./NewHomeIcons";
import { useTheme } from "./Theme";
import { fonts, spacing, type, type ThemeColors } from "./tokens";

type Props = {
  inputMode?: "url" | "caption";
  onChangeInputMode?: (mode: "url" | "caption") => void;
  url?: string;
  onChangeUrl?: (value: string) => void;
  captionText?: string;
  onChangeCaption?: (value: string) => void;
  onTranscribe?: () => void;
  onExtractCaption?: () => void;
  onPaste?: () => void;
  onClear?: () => void;
  loading?: boolean;
  error?: string | null;
};

export default function NewHomeScreen({
  inputMode,
  onChangeInputMode,
  url,
  onChangeUrl,
  captionText,
  onChangeCaption,
  onTranscribe,
  onExtractCaption,
  onPaste,
  onClear,
  loading = false,
  error = null,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => homeStyles(colors), [colors]);
  const [localUrl, setLocalUrl] = useState("");
  const [localCaption, setLocalCaption] = useState("");
  const [localMode, setLocalMode] = useState<"url" | "caption">("url");
  const mode = inputMode ?? localMode;
  const urlValue = url ?? localUrl;
  const captionValue = captionText ?? localCaption;
  const usingUrl = mode === "url";
  const canSubmit = !loading && (usingUrl ? urlValue.trim().length > 0 : captionValue.trim().length > 0);

  function setMode(next: "url" | "caption") {
    if (onChangeInputMode) onChangeInputMode(next);
    else setLocalMode(next);
  }

  function setUrlValue(next: string) {
    if (onChangeUrl) onChangeUrl(next);
    else setLocalUrl(next);
  }

  function setCaptionValue(next: string) {
    if (onChangeCaption) onChangeCaption(next);
    else setLocalCaption(next);
  }

  function submit() {
    if (usingUrl) onTranscribe?.();
    else onExtractCaption?.();
  }

  function clear() {
    if (onClear) onClear();
    else if (usingUrl) setUrlValue("");
    else setCaptionValue("");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.inputBlock}>
        <Text style={styles.promptTitle}>{usingUrl ? "Drop a ripe link." : "Drop a ripe caption."}</Text>
        <Pressable onPress={() => setMode(usingUrl ? "caption" : "url")}>
          <Text style={styles.promptAlt}>{usingUrl ? "Or a Reel caption" : "Or a link"}</Text>
        </Pressable>

        <View style={[styles.glowInput, !usingUrl && styles.glowInputCaption]}>
          {usingUrl ? (
            <View style={styles.linkIcon}>
              <IconLink />
            </View>
          ) : null}
          {usingUrl ? (
            <TextInput
              value={urlValue}
              onChangeText={setUrlValue}
              placeholder="TikTok, Instagram, YouTube, or a recipe blog…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submit}
            />
          ) : (
            <TextInput
              value={captionValue}
              onChangeText={setCaptionValue}
              placeholder={"Ingredients:\n1 cup flour\n...\n\nInstructions:\n1. Mix..."}
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.captionInput]}
              textAlignVertical="top"
            />
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionGhost} onPress={() => onPaste?.()} disabled={loading}>
            <Text style={styles.actionGhostText}>Paste</Text>
          </Pressable>
          <Pressable
            style={styles.actionGhost}
            onPress={clear}
            disabled={loading || !(usingUrl ? urlValue : captionValue).trim()}
          >
            <Text style={styles.actionGhostText}>Clear</Text>
          </Pressable>
          <Button variant="primary" onPress={submit} disabled={!canSubmit} style={styles.extractBtn}>
            {loading ? "Extracting…" : "Extract"}
          </Button>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

function homeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    paddingBottom: spacing.lg,
  },
  inputBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  promptTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fonts.heading,
  },
  promptAlt: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  glowInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.brand,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: spacing.md,
    shadowColor: colors.brand,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  glowInputCaption: { alignItems: "flex-start" },
  captionInput: { minHeight: 100 },
  linkIcon: { width: 20, height: 20, overflow: "hidden" },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.body,
    padding: 0,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  actionGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionGhostText: { color: colors.text, fontWeight: "600" },
  extractBtn: {
    borderRadius: 999,
    paddingHorizontal: 18,
    elevation: 0,
    shadowOpacity: 0,
  },
  error: { color: colors.error, marginTop: spacing.xs },
  });
}
