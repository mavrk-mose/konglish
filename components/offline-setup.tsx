import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type OfflineSetupProps = {
  error: string | null;
  progressMessage: string;
  onRetry: () => void;
};

export function OfflineSetup({
  error,
  progressMessage,
  onRetry,
}: OfflineSetupProps) {
  return (
    <SafeAreaView style={styles.screen}>
      {error ? null : <ActivityIndicator size="large" color="#186B52" />}
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>KONGLISH / OFFLINE SETUP</Text>
        <Text style={styles.title}>
          {error ? "Translation is not ready" : "Preparing your translator"}
        </Text>
        <Text style={styles.message}>{error ?? progressMessage}</Text>
        <Text style={styles.note}>
          The language files are saved on this device after the first download.
        </Text>
      </View>
      {error && Platform.OS !== "web" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry download</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#F3F5F0",
  },
  copy: {
    alignItems: "center",
    marginTop: 26,
  },
  eyebrow: {
    color: "#527468",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: "#15241E",
    fontSize: 26,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  message: {
    color: "#53645D",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  note: {
    color: "#87938D",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 28,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#186B52",
    borderRadius: 7,
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
