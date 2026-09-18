import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "./ui/tokens";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Pluck crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Pluck hit a snag.</Text>
        <Text style={styles.body}>
          Your saved recipes are still on this phone. Close and reopen the app, or tap
          Try again.
        </Text>
        <Text style={styles.detail}>{this.state.error.message}</Text>
        <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { color: colors.chromeText, fontSize: 28, fontWeight: "800" },
  body: { color: "#c4b8a8", fontSize: 16, lineHeight: 24 },
  detail: { color: colors.error, fontSize: 13 },
  btn: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  btnText: { color: colors.surface, fontWeight: "700" },
});
