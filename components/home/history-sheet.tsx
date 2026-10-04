import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { Download, Pencil } from "lucide-react-native";
import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AppTheme } from "@/constants/theme";
import type { TranscriptEntry } from "@/types/transcript";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

type HistorySheetProps = {
  visible: boolean;
  entries: TranscriptEntry[];
  theme: ScreenTheme;
  onDismiss: () => void;
  onExport: () => void;
  onEditEntry: (entry: TranscriptEntry) => void;
};

export function HistorySheet({
  visible,
  entries,
  theme,
  onDismiss,
  onExport,
  onEditEntry,
}: HistorySheetProps) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { height: windowHeight } = useWindowDimensions();
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 80,
    stiffness: 500,
  });

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      animationConfigs={animationConfigs}
      backgroundStyle={[
        styles.sheetBackground,
        { backgroundColor: theme.panel },
      ]}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: theme.muted }}
      maxDynamicContentSize={windowHeight * 0.75}
      onDismiss={onDismiss}
    >
      <BottomSheetView style={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.primary }]}>
            History
          </Text>
          <Pressable
            onPress={onExport}
            style={[
              styles.exportInline,
              { backgroundColor: theme.accentSoft },
            ]}
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
          <BottomSheetScrollView
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
                  <Text
                    style={[styles.historyTimestamp, { color: theme.muted }]}
                  >
                    {entry.timestamp}
                  </Text>
                  <View style={styles.historyActionsInline}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit completed translation"
                      onPress={() => onEditEntry(entry)}
                      style={styles.historyAction}
                    >
                      <Pencil
                        color={theme.primary}
                        size={16}
                        strokeWidth={2}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Export transcript"
                      onPress={onExport}
                      style={styles.historyAction}
                    >
                      <Download
                        color={theme.primary}
                        size={17}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                </View>
                <Text
                  style={[
                    styles.historyTextLabel,
                    { color: theme.secondary },
                  ]}
                >
                  Original
                </Text>
                <Text style={[styles.historyText, { color: theme.primary }]}>
                  {entry.ko}
                </Text>
                <Text
                  style={[
                    styles.historyTextLabel,
                    { color: theme.secondary },
                  ]}
                >
                  Translation
                </Text>
                <Text style={[styles.historyText, { color: theme.accent }]}>
                  {entry.en}
                </Text>
              </View>
            ))}
          </BottomSheetScrollView>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
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
