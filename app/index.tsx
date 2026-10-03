import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Animated, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ControlBar } from "@/components/home/control-bar";
import { HistorySheet } from "@/components/home/history-sheet";
import { LiveTranslationDisplay } from "@/components/home/live-translation-display";
import { SettingsSheet } from "@/components/home/settings-sheet";
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

        if (
          storedFontSize === "small" ||
          storedFontSize === "medium" ||
          storedFontSize === "large"
        ) {
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
  const currentLanguageLabel = direction === "ko-to-en" ? "한국어" : "English";

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
      (speech.translationError
        ? "Translation failed. Please try speaking again."
        : `${targetLanguage} translation will appear here.`),
    [speech.translationError, speech.translationText, targetLanguage],
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {speech.isListeningEnabled && <KeepAwakeWhileListening />}

      <LiveTranslationDisplay
        theme={theme}
        fontSize={FONT_SIZES[fontSizeMode]}
        transcriptText={transcriptText}
        translatedText={translatedText}
        onOpenHistory={() => setHistoryVisible(true)}
      />

      <ControlBar
        theme={theme}
        currentLanguageLabel={currentLanguageLabel}
        isRecording={speech.isRecording}
        languageAnimatedOpacity={languageAnimatedOpacity}
        soundLevel={speech.soundLevel}
        onOpenSettings={() => setSettingsVisible(true)}
        onToggleDirection={() =>
          setDirection((current) =>
            current === "ko-to-en" ? "en-to-ko" : "ko-to-en",
          )
        }
        onToggleListening={() => void speech.toggleListening()}
      />

      <HistorySheet
        visible={historyVisible}
        entries={entries}
        theme={theme}
        historySlide={historySlide}
        onDismiss={() => setHistoryVisible(false)}
        onExport={handleHistoryExport}
        onEditEntry={(entry) => startEditingEntry(entry)}
      />

      <SettingsSheet
        visible={settingsVisible}
        theme={theme}
        themeMode={themeMode}
        fontSizeMode={fontSizeMode}
        settingsSlide={settingsSlide}
        onDismiss={() => setSettingsVisible(false)}
        onToggleTheme={() =>
          setThemeMode((current) => (current === "dark" ? "light" : "dark"))
        }
        onSetFontSize={(size) => setFontSizeMode(size)}
        onDeleteAllHistory={handleDeleteAllHistory}
      />

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
});
