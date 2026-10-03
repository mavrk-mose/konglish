import { StyleSheet, Text, View } from "react-native";

type SpeechStatusFooterProps = {
  isRecording: boolean;
  status: string;
  error: string | null;
};

export function SpeechStatusFooter({
  isRecording,
  status,
  error,
}: SpeechStatusFooterProps) {
  return (
    <View style={styles.footer}>
      <View style={[styles.dot, !isRecording && styles.offlineDot]} />
      <View style={styles.copy}>
        <Text style={styles.status}>{status}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginTop: "auto",
    paddingBottom: 20,
  },
  copy: {
    flex: 1,
  },
  dot: {
    backgroundColor: "#35936B",
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  offlineDot: {
    backgroundColor: "#A53A31",
    marginTop: 5,
  },
  status: {
    color: "#718078",
    fontSize: 12,
  },
  error: {
    color: "#A53A31",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
