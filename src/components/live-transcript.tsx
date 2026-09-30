import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TranscriptEntry } from "@/types/transcript";

type LiveTranscriptProps = {
  koreanText: string;
  englishText: string;
  entries: TranscriptEntry[];
  onEditEntry: (entry: TranscriptEntry) => void;
  onDeleteEntry: (entry: TranscriptEntry) => void;
};

export function LiveTranscript({
  koreanText,
  englishText,
  entries,
  onEditEntry,
  onDeleteEntry,
}: LiveTranscriptProps) {
  return (
    <ScrollView style={styles.display} contentContainerStyle={styles.content}>
      <View style={styles.transcriptPanel}>
        <Text style={styles.panelLabel}>Korean transcript</Text>
        <Text style={styles.koreanText}>
          {koreanText || "Speak to begin..."}
        </Text>
      </View>

      <View style={[styles.transcriptPanel, styles.translationPanel]}>
        <Text style={styles.panelLabel}>English translation</Text>
        <Text style={styles.englishText}>
          {englishText || "Your translation will appear here."}
        </Text>
      </View>

      {entries.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={styles.historyHeader}>Completed sentences</Text>
          {[...entries].reverse().map((entry, index) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyMeta}>
                Sentence {entries.length - index} · {entry.timestamp}
              </Text>
              <Text style={styles.historyKo}>KR: {entry.ko}</Text>
              <Text style={styles.historyEn}>EN: {entry.en}</Text>
              <View style={styles.entryActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit completed translation"
                  onPress={() => onEditEntry(entry)}
                  style={styles.entryActionButton}
                >
                  <Text style={styles.entryActionText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete completed translation"
                  onPress={() => onDeleteEntry(entry)}
                  style={styles.entryActionButton}
                >
                  <Text style={styles.deleteActionText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  display: {
    flex: 1,
  },
  content: {
    paddingBottom: 16,
  },
  transcriptPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE5DE",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 14,
    minHeight: 142,
    padding: 18,
  },
  translationPanel: {
    backgroundColor: "#E9F0E9",
    borderColor: "#CFDDD0",
  },
  panelLabel: {
    color: "#718078",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 13,
    textTransform: "uppercase",
  },
  koreanText: {
    color: "#15241E",
    fontSize: 19,
    lineHeight: 28,
  },
  englishText: {
    color: "#186B52",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 27,
  },
  historySection: {
    borderTopColor: "#DDE5DE",
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 18,
  },
  historyHeader: {
    color: "#15241E",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  historyRow: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE5DE",
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
  },
  historyMeta: {
    color: "#718078",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  historyKo: {
    color: "#15241E",
    fontSize: 14,
    lineHeight: 20,
  },
  historyEn: {
    color: "#186B52",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 4,
  },
  entryActions: {
    borderTopColor: "#E8ECE8",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 18,
    marginTop: 12,
    paddingTop: 9,
  },
  entryActionButton: {
    minHeight: 30,
    justifyContent: "center",
  },
  entryActionText: {
    color: "#186B52",
    fontSize: 13,
    fontWeight: "700",
  },
  deleteActionText: {
    color: "#A53A31",
    fontSize: 13,
    fontWeight: "700",
  },
});
