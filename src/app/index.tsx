import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import TranslateText, {
  TranslateLanguage,
} from "@react-native-ml-kit/translate-text";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

import { LiveControls } from "@/components/live-controls";
import { LiveTranscript } from "@/components/live-transcript";
import { OfflineSetup } from "@/components/offline-setup";
import { SpeechStatusFooter } from "@/components/speech-status-footer";
import { TranscriptEditorModal } from "@/components/transcript-editor-modal";
import { useTranscript } from "@/hooks/use-transcript";

const MODEL_READY_KEY = "konglish.translation-models-ready";
const SPEECH_STABILITY_DELAY_MS = 400;
const FINAL_DUPLICATE_WINDOW_MS = 2500;

export default function HomeScreen() {
  const {
    entries: sessionTranscript,
    updateSavedTranscript,
    editingEntryId,
    setEditingEntryId,
    editKoreanText,
    setEditKoreanText,
    editEnglishText,
    setEditEnglishText,
    startEditingEntry,
    saveEditedEntry,
    confirmDeleteEntry,
    exportSessionLog,
  } = useTranscript();
  const [isModelReady, setIsModelReady] = useState(false);
  const [downloadProgressMessage, setDownloadProgressMessage] = useState(
    "Checking on-device English and Korean language files...",
  );
  const [modelError, setModelError] = useState<string | null>(null);
  const [koreanText, setKoreanText] = useState("");
  const [englishText, setEnglishText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isListeningEnabled, setIsListeningEnabled] = useState(true);
  const [speechStatus, setSpeechStatus] = useState("Starting microphone...");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const modelReadyRef = useRef(false);
  const shouldListenRef = useRef(true);
  const isStartingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const translationRequestRef = useRef(0);
  const latestKoreanTextRef = useRef("");
  const pendingInterimTextRef = useRef("");
  const stabilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastTranslatedTextRef = useRef("");
  const lastTranslationResultRef = useRef<{
    text: string;
    translation: string;
  } | null>(null);
  const inFlightTranslationsRef = useRef(
    new Map<string, Promise<string | null>>(),
  );
  const recentFinalTextsRef = useRef(new Map<string, number>());
  const transcriptSequenceRef = useRef(
    sessionTranscript.reduce(
      (highest, entry) => Math.max(highest, entry.sequence),
      0,
    ),
  );
  const onDeviceRecognitionAvailableRef = useRef<boolean | null>(null);
  const usingOnDeviceRecognitionRef = useRef(false);
  const retryProvisionRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const [soundLevel] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let isMounted = true;
    let restartTimeout: ReturnType<typeof setTimeout> | null = null;

    const showSettingsPrompt = (
      title: string,
      message: string,
      canAskAgain: boolean,
    ) => {
      shouldListenRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsListeningEnabled(false);
      setSpeechError(message);
      setSpeechStatus("Microphone permission is required");

      const buttons = [
        ...(canAskAgain
          ? [
              {
                text: "Try again",
                onPress: () => {
                  shouldListenRef.current = true;
                  setIsListeningEnabled(true);
                  void startListeningRef.current();
                },
              },
            ]
          : []),
        { text: "Not now", style: "cancel" as const },
        {
          text: "Open Settings",
          onPress: () => {
            void Linking.openSettings().catch((error: unknown) => {
              console.error("Could not open device settings:", error);
            });
          },
        },
      ];

      Alert.alert(title, message, buttons);
    };

    const ensureRecordingPermissions = async () => {
      let permissions = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!permissions.granted) {
        permissions =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      }

      if (!permissions.granted) {
        showSettingsPrompt(
          "Microphone and speech access needed",
          "Konglish needs microphone and speech-recognition access to transcribe and translate spoken Korean. Enable both permissions in Settings to continue.",
          permissions.canAskAgain,
        );
        return false;
      }

      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        showSettingsPrompt(
          "Speech recognition unavailable",
          "No speech recognition service is available on this device. Enable or install a speech recognition service, then try again.",
          false,
        );
        return false;
      }

      return true;
    };

    const scheduleRestart = (delay = 600) => {
      if (!isMounted || !shouldListenRef.current || restartTimeout) return;

      restartTimeout = setTimeout(() => {
        restartTimeout = null;
        void startListening();
      }, delay);
    };

    const canUseOnDeviceKoreanRecognition = async () => {
      if (Platform.OS !== "android") return false;
      if (onDeviceRecognitionAvailableRef.current !== null) {
        return onDeviceRecognitionAvailableRef.current;
      }

      try {
        if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
          onDeviceRecognitionAvailableRef.current = false;
          return false;
        }

        const { installedLocales } =
          await ExpoSpeechRecognitionModule.getSupportedLocales({});
        onDeviceRecognitionAvailableRef.current = installedLocales.some(
          (locale) =>
            locale.toLowerCase().replaceAll("_", "-").startsWith("ko"),
        );
      } catch (error) {
        onDeviceRecognitionAvailableRef.current = false;
        if (__DEV__) {
          console.warn("[Speech] Could not check offline Korean model:", error);
        }
      }

      return onDeviceRecognitionAvailableRef.current;
    };

    const startListening = async () => {
      if (
        !isMounted ||
        !modelReadyRef.current ||
        !shouldListenRef.current ||
        isStartingRef.current ||
        isRecordingRef.current
      ) {
        return;
      }

      if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
      }

      isStartingRef.current = true;
      setSpeechError(null);
      setSpeechStatus("Requesting microphone and speech recognition...");

      try {
        const hasPermissions = await ensureRecordingPermissions();
        if (!hasPermissions) return;

        const requiresOnDeviceRecognition =
          await canUseOnDeviceKoreanRecognition();
        if (!isMounted || !shouldListenRef.current) return;
        usingOnDeviceRecognitionRef.current = requiresOnDeviceRecognition;
        if (__DEV__) {
          console.log(
            `[Speech] Using ${requiresOnDeviceRecognition ? "on-device Korean" : "the default"} recognizer.`,
          );
        }

        ExpoSpeechRecognitionModule.start({
          lang: "ko-KR",
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
          requiresOnDeviceRecognition,
          addsPunctuation: requiresOnDeviceRecognition,
          volumeChangeEventOptions: {
            enabled: true,
            intervalMillis: 100,
          },
        });
        if (isMounted && shouldListenRef.current) {
          setSpeechStatus("Starting Korean speech recognition...");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not start speech recognition.";
        console.error("Voice engine start failed:", error);
        isRecordingRef.current = false;
        shouldListenRef.current = false;
        if (isMounted) {
          setIsRecording(false);
          setIsListeningEnabled(false);
          setSpeechError(message);
          setSpeechStatus("Microphone could not start");
          if (/permission|denied|not allowed/i.test(message)) {
            showSettingsPrompt(
              "Microphone access needed",
              "Konglish could not access the microphone. Enable microphone and speech-recognition access in Settings, then try again.",
              false,
            );
          }
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    startListeningRef.current = startListening;

    const prepareLocalTranslationModels = async () => {
      setModelError(null);

      if (Platform.OS === "web") {
        setModelError(
          "Offline translation requires an iOS or Android development build.",
        );
        return;
      }

      try {
        const wasProvisioned = await AsyncStorage.getItem(MODEL_READY_KEY);
        if (!isMounted) return;
        if (wasProvisioned === "true") {
          modelReadyRef.current = true;
          setIsModelReady(true);
          void startListening();
          return;
        }

        setDownloadProgressMessage(
          "Preparing on-device English and Korean language files...",
        );
        await TranslateText.translate({
          text: "안녕",
          sourceLanguage: TranslateLanguage.KOREAN,
          targetLanguage: TranslateLanguage.ENGLISH,
          downloadModelIfNeeded: true,
        });
        await AsyncStorage.setItem(MODEL_READY_KEY, "true");

        if (isMounted) {
          modelReadyRef.current = true;
          setIsModelReady(true);
          void startListening();
        }
      } catch (error) {
        console.error("Failed to provision local ML models:", error);
        if (isMounted) {
          setModelError(
            "Required translation packs could not be downloaded. Check your internet connection and try again.",
          );
        }
      }
    };

    retryProvisionRef.current = () => {
      setDownloadProgressMessage(
        "Preparing on-device English and Korean language files...",
      );
      void prepareLocalTranslationModels();
    };

    const updateKoreanTranscript = (text: string) => {
      if (latestKoreanTextRef.current === text) return;
      latestKoreanTextRef.current = text;
      translationRequestRef.current += 1;
      setKoreanText((current) => (current === text ? current : text));
    };

    const applyTranslation = (
      requestId: number,
      text: string,
      translation: string,
    ) => {
      if (!isMounted || requestId !== translationRequestRef.current) {
        if (__DEV__) {
          console.log(`[Translation] stale result ignored: ${text}`);
        }
        return false;
      }

      lastTranslationResultRef.current = { text, translation };
      setEnglishText((current) =>
        current === translation ? current : translation,
      );
      if (__DEV__) {
        console.log(`[Translation] result: ${text} => ${translation}`);
      }
      return true;
    };

    const translateKorean = async (korean: string) => {
      const text = korean.trim().replace(/\s+/gu, " ");
      if (!text || !modelReadyRef.current) return null;

      const requestId = ++translationRequestRef.current;
      const cachedTranslation = lastTranslationResultRef.current;
      if (cachedTranslation?.text === text) {
        if (__DEV__) {
          console.log(`[Translation] skipped duplicate: ${text}`);
        }
        if (isMounted && requestId === translationRequestRef.current) {
          setEnglishText((current) =>
            current === cachedTranslation.translation
              ? current
              : cachedTranslation.translation,
          );
        }
        return cachedTranslation.translation;
      }

      const inFlightTranslation = inFlightTranslationsRef.current.get(text);
      if (inFlightTranslation) {
        if (__DEV__) {
          console.log(`[Translation] skipped duplicate: ${text}`);
        }
        lastTranslatedTextRef.current = text;
        try {
          const translation = await inFlightTranslation;
          if (translation !== null) {
            applyTranslation(requestId, text, translation);
          }
          return translation;
        } catch (error) {
          if (__DEV__) {
            console.warn("[Translation] failed:", error);
          }
          return null;
        }
      }

      lastTranslatedTextRef.current = text;
      lastTranslationResultRef.current = null;
      if (__DEV__) {
        console.log(`[Translation] requested: ${text}`);
      }

      const translationPromise = TranslateText.translate({
        text,
        sourceLanguage: TranslateLanguage.KOREAN,
        targetLanguage: TranslateLanguage.ENGLISH,
        downloadModelIfNeeded: false,
      }).then((result) => result as string);
      inFlightTranslationsRef.current.set(text, translationPromise);

      try {
        const translation = await translationPromise;
        applyTranslation(requestId, text, translation);
        return translation;
      } catch (error) {
        if (
          requestId === translationRequestRef.current &&
          lastTranslatedTextRef.current === text
        ) {
          lastTranslatedTextRef.current = "";
        }
        if (__DEV__) {
          console.warn("[Translation] failed:", error);
        }
        return null;
      } finally {
        if (inFlightTranslationsRef.current.get(text) === translationPromise) {
          inFlightTranslationsRef.current.delete(text);
        }
      }
    };

    const handleSpeechResults = async (
      event: ExpoSpeechRecognitionResultEvent,
    ) => {
      const recognizedKorean = event.results[0]?.transcript
        ?.trim()
        .replace(/\s+/gu, " ");
      if (!recognizedKorean || !modelReadyRef.current) return;

      updateKoreanTranscript(recognizedKorean);

      if (event.isFinal) {
        if (stabilityTimeoutRef.current) {
          clearTimeout(stabilityTimeoutRef.current);
          stabilityTimeoutRef.current = null;
        }
        pendingInterimTextRef.current = "";
        if (__DEV__) {
          console.log(`[Speech] final: ${recognizedKorean}`);
        }

        const now = Date.now();
        for (const [text, timestamp] of recentFinalTextsRef.current) {
          if (now - timestamp > FINAL_DUPLICATE_WINDOW_MS) {
            recentFinalTextsRef.current.delete(text);
          }
        }
        if (recentFinalTextsRef.current.has(recognizedKorean)) {
          if (__DEV__) {
            console.log(`[Translation] skipped duplicate: ${recognizedKorean}`);
          }
          return;
        }
        recentFinalTextsRef.current.set(recognizedKorean, now);

        const sequence = ++transcriptSequenceRef.current;
        const timestamp = new Date(now).toLocaleTimeString();
        const translation = await translateKorean(recognizedKorean);
        if (!isMounted || translation === null) return;

        const id = `${now}-${sequence}`;
        updateSavedTranscript((entries) =>
          [
            ...entries,
            {
              id,
              sequence,
              ko: recognizedKorean,
              en: translation,
              timestamp,
            },
          ].sort((first, second) => first.sequence - second.sequence),
        );
        return;
      }

      if (__DEV__) {
        console.log(`[Speech] interim: ${recognizedKorean}`);
      }
      if (pendingInterimTextRef.current === recognizedKorean) return;

      pendingInterimTextRef.current = recognizedKorean;
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
      }
      stabilityTimeoutRef.current = setTimeout(() => {
        stabilityTimeoutRef.current = null;
        if (
          pendingInterimTextRef.current !== recognizedKorean ||
          latestKoreanTextRef.current !== recognizedKorean ||
          !shouldListenRef.current
        ) {
          return;
        }

        const boundaries = [
          ...recognizedKorean.matchAll(
            /(?:습니다|어요|네요|죠|다|요)?[.!?]+\s+/gu,
          ),
        ];
        const lastBoundary = boundaries[boundaries.length - 1];
        const sentence =
          lastBoundary?.index === undefined
            ? recognizedKorean
            : recognizedKorean
                .slice(lastBoundary.index + lastBoundary[0].length)
                .trim() || recognizedKorean;
        void translateKorean(sentence);
      }, SPEECH_STABILITY_DELAY_MS);
    };

    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener("result", handleSpeechResults),
      ExpoSpeechRecognitionModule.addListener("start", () => {
        isStartingRef.current = false;
        isRecordingRef.current = true;
        setIsRecording(true);
        setSpeechError(null);
        setSpeechStatus("Listening for Korean speech...");
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => {
        isStartingRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
        soundLevel.setValue(0);
        if (shouldListenRef.current) {
          setSpeechStatus("Listening paused; restarting microphone...");
          scheduleRestart();
        }
      }),
      ExpoSpeechRecognitionModule.addListener("error", (event) => {
        const message = event.message || event.error;
        isStartingRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
        soundLevel.setValue(0);

        if (
          usingOnDeviceRecognitionRef.current &&
          (event.error === "language-not-supported" ||
            event.error === "service-not-allowed")
        ) {
          usingOnDeviceRecognitionRef.current = false;
          onDeviceRecognitionAvailableRef.current = false;
          if (__DEV__) {
            console.warn(
              "[Speech] Offline Korean recognition failed; retrying with the default recognizer.",
            );
          }
          setSpeechStatus("Switching to the default speech recognizer...");
          scheduleRestart(100);
        } else if (event.error === "aborted") {
          if (shouldListenRef.current) scheduleRestart();
        } else if (
          event.error === "no-speech" ||
          event.error === "speech-timeout"
        ) {
          if (shouldListenRef.current) {
            setSpeechStatus("No speech heard; continuing to listen...");
            scheduleRestart(900);
          }
        } else if (event.error === "not-allowed") {
          console.warn("Speech recognition permission denied:", message);
          showSettingsPrompt(
            "Microphone and speech access needed",
            "Konglish was denied microphone or speech-recognition access. Enable both permissions in Settings, then tap Start listening.",
            false,
          );
        } else if (event.error === "service-not-allowed") {
          console.warn("Speech recognition service unavailable:", message);
          shouldListenRef.current = false;
          setIsListeningEnabled(false);
          setSpeechError(
            "No speech recognition service is available on this device.",
          );
          setSpeechStatus("Speech recognition unavailable");
        } else if (shouldListenRef.current) {
          console.warn("Speech recognition failed:", event.error, message);
          setSpeechStatus("Speech paused; restarting microphone...");
          scheduleRestart(1000);
        } else {
          console.warn("Speech recognition stopped:", event.error, message);
          setSpeechStatus(message || "Listening stopped");
        }
      }),
      ExpoSpeechRecognitionModule.addListener("volumechange", (event) => {
        const level = Math.max(0, Math.min(1, event.value / 10));
        Animated.timing(soundLevel, {
          toValue: level,
          duration: 100,
          useNativeDriver: true,
        }).start();
      }),
    ];

    retryProvisionRef.current();

    return () => {
      isMounted = false;
      shouldListenRef.current = false;
      if (restartTimeout) clearTimeout(restartTimeout);
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
        stabilityTimeoutRef.current = null;
      }
      ExpoSpeechRecognitionModule.abort();
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [soundLevel, updateSavedTranscript]);

  const toggleListening = async () => {
    if (!modelReadyRef.current) return;

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
        stabilityTimeoutRef.current = null;
      }
      pendingInterimTextRef.current = "";
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsListeningEnabled(false);
      setSpeechError(null);
      setSpeechStatus("Listening stopped");
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.error("Voice engine stop failed:", error);
      }
    } else {
      shouldListenRef.current = true;
      setIsListeningEnabled(true);
      latestKoreanTextRef.current = "";
      pendingInterimTextRef.current = "";
      recentFinalTextsRef.current.clear();
      translationRequestRef.current += 1;
      setKoreanText("");
      setEnglishText("");
      setSpeechError(null);
      void startListeningRef.current();
    }
  };

  if (!isModelReady) {
    return (
      <OfflineSetup
        error={modelError}
        progressMessage={downloadProgressMessage}
        onRetry={() => retryProvisionRef.current()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LiveControls
        isRecording={isRecording}
        isListeningEnabled={isListeningEnabled}
        soundLevel={soundLevel}
        onToggleListening={() => void toggleListening()}
        onExport={() =>
          void exportSessionLog(koreanText, englishText, isRecording)
        }
      />
      <LiveTranscript
        koreanText={koreanText}
        englishText={englishText}
        entries={sessionTranscript}
        onEditEntry={startEditingEntry}
        onDeleteEntry={confirmDeleteEntry}
      />
      <TranscriptEditorModal
        visible={editingEntryId !== null}
        koreanText={editKoreanText}
        englishText={editEnglishText}
        onChangeKoreanText={setEditKoreanText}
        onChangeEnglishText={setEditEnglishText}
        onClose={() => setEditingEntryId(null)}
        onSave={saveEditedEntry}
      />
      <SpeechStatusFooter
        isRecording={isRecording}
        status={speechStatus}
        error={speechError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F5F0",
    paddingHorizontal: 24,
    paddingTop: 28,
  },
});
