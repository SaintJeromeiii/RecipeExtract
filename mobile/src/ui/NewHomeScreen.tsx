import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "./Button";
import { IconLink } from "./NewHomeIcons";
import { colors, fonts, spacing } from "./tokens";

const figma = {
  accent: "#85B8FF",
  surface: "#141416",
  line: "#28282C",
  muted: "#99999F",
};

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
              placeholderTextColor={figma.muted}
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
              placeholderTextColor={figma.muted}
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

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    paddingBottom: spacing.lg,
  },
  inputBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 8,
    gap: 8,
  },
  promptTitle: {
    color: colors.chromeText,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: fonts.heading,
  },
  promptAlt: {
    color: figma.accent,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  glowInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: figma.surface,
    borderColor: figma.accent,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: spacing.md,
    shadowColor: figma.accent,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  glowInputCaption: { alignItems: "flex-start" },
  captionInput: { minHeight: 100 },
  linkIcon: { width: 20, height: 20, overflow: "hidden" },
  input: {
    flex: 1,
    color: colors.chromeText,
    fontSize: 14,
    fontFamily: fonts.body,
    padding: 0,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionGhost: {
    borderWidth: 1,
    borderColor: figma.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionGhostText: { color: colors.chromeText, fontWeight: "600" },
  extractBtn: {
    backgroundColor: figma.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    elevation: 0,
    shadowOpacity: 0,
  },
  error: { color: colors.error, marginTop: 4 },
});
