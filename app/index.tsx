import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ControlBar } from "@/components/home/control-bar";
import {
  LiveTranslationDisplay,
  type TranslationItem,
} from "@/components/home/live-translation-display";
import { SettingsSheet } from "@/components/home/settings-sheet";
import { AppTheme } from "@/constants/theme";
import { OfflineSetup } from "@/components/offline-setup";
import { clearLiveHistory } from "@/lib/live-translation-history";
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

export default function HomeScreen() {
  const { translationId } = useLocalSearchParams<{
    translationId?: string;
  }>();
  const systemTheme = useColorScheme();
  const [direction, setDirection] = useState<TranslationDirection>("ko-to-en");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    systemTheme === "dark" ? "dark" : "light",
  );
  const [fontSizeMode, setFontSizeMode] = useState<FontSizeMode>("medium");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [finalizedSegments, setFinalizedSegments] = useState<TranslationItem[]>(
    [],
  );
  const directionRef = useRef(direction);
  const theme = AppTheme[themeMode];

  const handleTranslationFocusHandled = useCallback(() => {
    router.setParams({ translationId: undefined });
  }, []);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

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

  const {
    entries,
    updateSavedTranscript,
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
      setFinalizedSegments((currentSegments) => [
        ...currentSegments,
        {
          id: entry.id,
          transcript:
            directionRef.current === "ko-to-en" ? entry.ko : entry.en,
          translation:
            directionRef.current === "ko-to-en" ? entry.en : entry.ko,
          createdAt: Number.parseInt(entry.id.split("-")[0], 10),
        },
      ]);
    },
    [updateSavedTranscript],
  );

  const speech = useSpeechTranslation({
    enabled: isReady,
    direction,
    initialSequence,
    onTranscriptComplete: appendTranscriptEntry,
  });

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

  const handleDeleteAllHistory = () => {
    Alert.alert(
      "Delete all history?",
      "This action cannot be undone. All saved completed translations will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            updateSavedTranscript(() => []);
            clearLiveHistory();
            setHistoryVersion((version) => version + 1);
            setFinalizedSegments([]);
          },
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
        key={historyVersion}
        theme={theme}
        fontSize={FONT_SIZES[fontSizeMode]}
        transcriptText={transcriptText}
        translatedText={translatedText}
        canCopyTranslation={Boolean(speech.translationText?.trim())}
        hasLiveTranscript={Boolean(speech.sourceText.trim())}
        finalizedSegments={finalizedSegments}
        translationId={translationId}
        onTranslationFocusHandled={handleTranslationFocusHandled}
        onOpenSearch={() => router.push("/search" as Href)}
      />

      <ControlBar
        theme={theme}
        currentLanguageLabel={currentLanguageLabel}
        isRecording={speech.isRecording}
        soundLevel={speech.soundLevel}
        onOpenSettings={() => setSettingsVisible(true)}
        onToggleDirection={() =>
          setDirection((current) =>
            current === "ko-to-en" ? "en-to-ko" : "ko-to-en",
          )
        }
        onToggleListening={() => void speech.toggleListening()}
      />

      <SettingsSheet
        visible={settingsVisible}
        theme={theme}
        themeMode={themeMode}
        fontSizeMode={fontSizeMode}
        onDismiss={() => setSettingsVisible(false)}
        onToggleTheme={() =>
          setThemeMode((current) => (current === "dark" ? "light" : "dark"))
        }
        onSetFontSize={setFontSizeMode}
        onDeleteAllHistory={handleDeleteAllHistory}
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
