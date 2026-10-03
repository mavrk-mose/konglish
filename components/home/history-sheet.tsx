import { Download, Pencil } from "lucide-react-native";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppTheme } from "@/constants/theme";
import type { TranscriptEntry } from "@/types/transcript";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

type HistorySheetProps = {
  visible: boolean;
  entries: TranscriptEntry[];
  theme: ScreenTheme;
  historySlide: Animated.Value;
  onDismiss: () => void;
  onExport: () => void;
  onEditEntry: (entry: TranscriptEntry) => void;
};

export function HistorySheet({
  visible,
  entries,
  theme,
  historySlide,
  onDismiss,
  onExport,
  onEditEntry,
}: HistorySheetProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
      <Animated.View
        style={[
          styles.modalSheet,
          {
            backgroundColor: theme.panel,
            transform: [{ translateY: historySlide }],
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.primary }]}>History</Text>
          <Pressable
            onPress={onExport}
            style={[styles.exportInline, { backgroundColor: theme.accentSoft }]}
          >
            <Download color={theme.primary} size={16} strokeWidth={2} />
            <Text style={[styles.exportInlineText, { color: theme.primary }]}>
              Export
            </Text>
          </Pressable>
        </View>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.primary }]}>
              No completed translations yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.secondary }]}>
              Finished sentences appear here after you stop recording.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.historyList}
            contentContainerStyle={styles.historyContent}
          >
            {[...entries].reverse().map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.historyItem,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.panelAlt,
                  },
                ]}
              >
                <View style={styles.historyMetaRow}>
                  <Text style={[styles.historyTimestamp, { color: theme.muted }]}>
                    {entry.timestamp}
                  </Text>
                  <View style={styles.historyActionsInline}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit completed translation"
                      onPress={() => onEditEntry(entry)}
                      style={styles.historyAction}
                    >
                      <Pencil color={theme.primary} size={16} strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Export transcript"
                      onPress={onExport}
                      style={styles.historyAction}
                    >
                      <Download color={theme.primary} size={17} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
                <Text style={[styles.historyTextLabel, { color: theme.secondary }]}>
                  Original
                </Text>
                <Text style={[styles.historyText, { color: theme.primary }]}>
                  {entry.ko}
                </Text>
                <Text style={[styles.historyTextLabel, { color: theme.secondary }]}>
                  Translation
                </Text>
                <Text style={[styles.historyText, { color: theme.accent }]}>
                  {entry.en}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  exportInline: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exportInlineText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyBody: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
  },
  historyList: {
    maxHeight: 400,
  },
  historyContent: {
    paddingBottom: 18,
  },
  historyItem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyTimestamp: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyActionsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTextLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  historyText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
