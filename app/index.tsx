import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppTheme } from "@/constants/theme";
import { OfflineSetup } from "@/components/offline-setup";
import { TranscriptEditorModal } from "@/components/transcript-editor-modal";
import { useSpeechTranslation } from "@/hooks/use-speech-translation";
import { useTranscript } from "@/hooks/use-transcript";
import { useTranslationModels } from "@/hooks/use-translation-models";
import type { TranscriptEntry } from "@/types/transcript";
import type { TranslationDirection } from "@/types/translation";

const THEME_STORAGE_KEY = "konglish.theme-mode";
const FONT_SIZE_STORAGE_KEY = "konglish.font-size";

type ThemeMode = "light" | "dark";
type FontSizeMode = "small" | "medium" | "large";

function KeepAwakeWhileListening() {
  useKeepAwake();
  return null;
}

const FONT_SIZES: Record<FontSizeMode, number> = {
  small: 18,
  medium: 22,
  large: 28,
};

const languageAnimatedOpacity = new Animated.Value(1);
const historySlide = new Animated.Value(420);
const settingsSlide = new Animated.Value(420);
const micScale = new Animated.Value(1);

export default function HomeScreen() {
  const systemTheme = useColorScheme();
  const [direction, setDirection] = useState<TranslationDirection>("ko-to-en");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    systemTheme === "dark" ? "dark" : "light",
  );
  const [fontSizeMode, setFontSizeMode] = useState<FontSizeMode>("medium");
  const [historyVisible, setHistoryVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const theme = AppTheme[themeMode];

  useEffect(() => {
    let isMounted = true;
    const loadPreferences = async () => {
      try {
        const [storedTheme, storedFontSize] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY),
        ]);

        if (!isMounted) return;

        if (storedTheme === "dark" || storedTheme === "light") {
          setThemeMode(storedTheme);
        }

        if (storedFontSize === "small" || storedFontSize === "medium" || storedFontSize === "large") {
          setFontSizeMode(storedFontSize);
        }
      } catch (error) {
        console.warn("Could not load app preferences:", error);
      }
    };

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    void AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSizeMode);
  }, [fontSizeMode]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(languageAnimatedOpacity, {
        toValue: 0.45,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(languageAnimatedOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [direction]);

  const {
    entries,
    updateSavedTranscript,
    editingEntryId,
    setEditingEntryId,
    editKoreanText,
    setEditKoreanText,
    editEnglishText,
    setEditEnglishText,
    isSavingEdit,
    startEditingEntry,
    saveEditedEntry,
    exportSessionLog,
  } = useTranscript();
  const {
    isReady,
    progressMessage,
    error: modelError,
    retry,
  } = useTranslationModels();
  const initialSequence = entries.reduce(
    (highest, entry) => Math.max(highest, entry.sequence),
    0,
  );
  const appendTranscriptEntry = useCallback(
    (entry: TranscriptEntry) => {
      updateSavedTranscript((currentEntries) =>
        [...currentEntries, entry].sort(
          (first, second) => first.sequence - second.sequence,
        ),
      );
    },
    [updateSavedTranscript],
  );
  const speech = useSpeechTranslation({
    enabled: isReady,
    direction,
    initialSequence,
    onTranscriptComplete: appendTranscriptEntry,
  });

  useEffect(() => {
    Animated.spring(micScale, {
      toValue: speech.isRecording ? 1.12 : 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [speech.isRecording]);

  useEffect(() => {
    Animated.timing(historySlide, {
      toValue: historyVisible ? 0 : 420,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [historyVisible]);

  useEffect(() => {
    Animated.timing(settingsSlide, {
      toValue: settingsVisible ? 0 : 420,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [settingsVisible]);

  const targetLanguage = direction === "ko-to-en" ? "English" : "Korean";
  const currentLanguageLabel =
    direction === "ko-to-en" ? "한국어" : "English";

  const transcriptText = useMemo(
    () =>
      direction === "ko-to-en"
        ? speech.sourceText || "Speak Korean to begin..."
        : speech.sourceText || "Speak English to begin...",
    [direction, speech.sourceText],
  );
  const translatedText = useMemo(
    () =>
      speech.translationText ||
      `${targetLanguage} translation will appear here.`,
    [speech.translationText, targetLanguage],
  );

  const handleHistoryExport = async () => {
    await exportSessionLog("", "", false);
  };

  const handleDeleteAllHistory = () => {
    Alert.alert(
      "Delete all history?",
      "This action cannot be undone. Only saved completed translations will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => updateSavedTranscript(() => []),
        },
      ],
    );
  };

  if (!isReady) {
    return (
      <OfflineSetup
        error={modelError}
        progressMessage={progressMessage}
        onRetry={retry}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {speech.isListeningEnabled && <KeepAwakeWhileListening />}

      <View style={styles.topRow}>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open history"
          onPress={() => setHistoryVisible(true)}
          style={[styles.iconButton, { backgroundColor: theme.panelAlt }]}
        >
          <Text style={[styles.iconText, { color: theme.primary }]}>⏱</Text>
        </Pressable>
      </View>

      <View style={styles.liveArea}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setHistoryVisible(true)}
          style={styles.historyHint}
        >
          <Text style={[styles.historyHintLabel, { color: theme.secondary }]}>Swipe down to see history</Text>
          <Text style={[styles.historyHintArrow, { color: theme.secondary }]}>⌄</Text>
        </Pressable>

        <View style={styles.textBlock}>
          <Text style={[styles.listeningLabel, { color: theme.primary }]}>Listening...</Text>
          <Text style={[styles.mainText, { color: theme.primary, fontSize: FONT_SIZES[fontSizeMode] }]}>{transcriptText}</Text>
          <Text style={[styles.translationText, { color: theme.secondary, fontSize: FONT_SIZES[fontSizeMode] * 0.9 }]}>{translatedText}</Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => setSettingsVisible(true)}
          style={[styles.controlButton, { backgroundColor: theme.panelAlt }]} 
        >
          <Text style={[styles.controlText, { color: theme.primary }]}>⚙</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch language"
          onPress={() => setDirection((current) => (current === "ko-to-en" ? "en-to-ko" : "ko-to-en"))}
          style={[styles.languageButton, { backgroundColor: theme.panelAlt }]}
        >
          <Animated.Text
            style={[
              styles.languageText,
              { color: theme.primary, opacity: languageAnimatedOpacity },
            ]}
          >
            {currentLanguageLabel}
          </Animated.Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speech.isRecording ? "Stop recording" : "Start recording"}
          onPress={() => void speech.toggleListening()}
          style={[styles.micButton, { backgroundColor: theme.panelAlt, shadowColor: theme.shadow }]} 
        >
          <Animated.View
            style={[
              styles.micInner,
              {
                transform: [{ scale: micScale }],
                backgroundColor: speech.isRecording ? theme.danger : theme.buttonBg,
              },
            ]}
          >
            <Text style={[styles.micText, { color: speech.isRecording ? "#fff" : theme.buttonText }]}>{speech.isRecording ? "■" : "◉"}</Text>
          </Animated.View>
        </Pressable>
      </View>

      <Modal transparent visible={historyVisible} animationType="none" onRequestClose={() => setHistoryVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setHistoryVisible(false)} />
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
            <Pressable onPress={handleHistoryExport} style={[styles.exportInline, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.exportInlineText, { color: theme.primary }]}>Export</Text>
            </Pressable>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.primary }]}>No completed translations yet</Text>
              <Text style={[styles.emptyBody, { color: theme.secondary }]}>Finished sentences appear here after you stop recording.</Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList} contentContainerStyle={styles.historyContent}>
              {[...entries].reverse().map((entry) => (
                <View key={entry.id} style={[styles.historyItem, { borderColor: theme.border, backgroundColor: theme.panelAlt }]}>
                  <View style={styles.historyMetaRow}>
                    <Text style={[styles.historyTimestamp, { color: theme.muted }]}>{entry.timestamp}</Text>
                    <View style={styles.historyActionsInline}>
                      <Pressable onPress={() => startEditingEntry(entry)} style={styles.historyAction}>
                        <Text style={[styles.historyActionText, { color: theme.primary }]}>✎</Text>
                      </Pressable>
                      <Pressable onPress={() => void exportSessionLog("", "", false)} style={styles.historyAction}>
                        <Text style={[styles.historyActionText, { color: theme.primary }]}>↓</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={[styles.historyTextLabel, { color: theme.secondary }]}>Original</Text>
                  <Text style={[styles.historyText, { color: theme.primary }]}>{entry.ko}</Text>
                  <Text style={[styles.historyTextLabel, { color: theme.secondary }]}>Translation</Text>
                  <Text style={[styles.historyText, { color: theme.accent }]}>{entry.en}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </Modal>

      <Modal transparent visible={settingsVisible} animationType="none" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsVisible(false)} />
        <Animated.View
          style={[
            styles.modalSheet,
            { backgroundColor: theme.panel, transform: [{ translateY: settingsSlide }] },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: theme.primary }]}>Settings</Text>

          <View style={styles.settingSection}>
            <Text style={[styles.settingLabel, { color: theme.secondary }]}>Appearance</Text>
            <View style={[styles.settingRow, { backgroundColor: theme.panelAlt }]}> 
              <Text style={[styles.settingText, { color: theme.primary }]}>{themeMode === "dark" ? "Dark mode" : "Light mode"}</Text>
              <Pressable
                onPress={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
                style={[styles.switch, { backgroundColor: themeMode === "dark" ? theme.accent : theme.border }]}
              >
                <View style={[styles.switchThumb, { transform: [{ translateX: themeMode === "dark" ? 20 : 0 }] }]} />
              </Pressable>
            </View>
          </View>

          <View style={styles.settingSection}>
            <Text style={[styles.settingLabel, { color: theme.secondary }]}>Font size</Text>
            <View style={[styles.segmentedControl, { backgroundColor: theme.panelAlt }]}>
              {(["small", "medium", "large"] as FontSizeMode[]).map((size) => (
                <Pressable
                  key={size}
                  onPress={() => setFontSizeMode(size)}
                  style={[
                    styles.segmentItem,
                    {
                      backgroundColor:
                        fontSizeMode === size ? theme.buttonBg : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: fontSizeMode === size ? theme.buttonText : theme.primary },
                    ]}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleDeleteAllHistory}
            style={[styles.dangerButton, { backgroundColor: theme.panelAlt }]}
          >
            <Text style={[styles.dangerText, { color: theme.danger }]}>Delete all history</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      <TranscriptEditorModal
        visible={editingEntryId !== null}
        koreanText={editKoreanText}
        englishText={editEnglishText}
        isSaving={isSavingEdit}
        onChangeKoreanText={setEditKoreanText}
        onChangeEnglishText={setEditEnglishText}
        onClose={() => setEditingEntryId(null)}
        onSave={() => void saveEditedEntry(direction)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 8,
  },
  statusTime: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusChip: {
    fontSize: 12,
    fontWeight: "700",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  spacer: {
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  iconText: {
    fontSize: 20,
  },
  liveArea: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 8,
  },
  historyHint: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 24,
  },
  historyHintLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  historyHintArrow: {
    fontSize: 24,
    marginTop: 4,
  },
  textBlock: {
    justifyContent: "center",
    gap: 18,
  },
  listeningLabel: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 10,
  },
  mainText: {
    fontWeight: "500",
    lineHeight: 32,
  },
  translationText: {
    fontWeight: "500",
    lineHeight: 28,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 18,
    paddingTop: 16,
  },
  controlButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: {
    fontSize: 24,
  },
  languageButton: {
    height: 52,
    minWidth: 122,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  languageText: {
    fontSize: 18,
    fontWeight: "700",
  },
  micButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  micInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  micText: {
    fontSize: 20,
    fontWeight: "800",
  },
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
    borderRadius: 999,
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
  historyActionText: {
    fontSize: 16,
    fontWeight: "700",
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
  settingSection: {
    marginTop: 16,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 1,
  },
  settingRow: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingText: {
    fontSize: 16,
    fontWeight: "600",
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  segmentedControl: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
  },
  dangerButton: {
    marginTop: 22,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
