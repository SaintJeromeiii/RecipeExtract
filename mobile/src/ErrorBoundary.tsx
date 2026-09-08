import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RecipeGuru crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>RecipeGuru hit a snag.</Text>
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
    backgroundColor: "#0e1519",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { color: "#f7f3eb", fontSize: 28, fontWeight: "800" },
  body: { color: "#c4b8a8", fontSize: 16, lineHeight: 24 },
  detail: { color: "#ff9b8a", fontSize: 13 },
  btn: {
    alignSelf: "flex-start",
    backgroundColor: "#ff5a3c",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  btnText: { color: "#fff8f5", fontWeight: "700" },
});
