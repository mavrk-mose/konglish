import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import TranslateText, {
  TranslateLanguage,
} from "@react-native-ml-kit/translate-text";
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from "@react-native-voice/voice";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const MODEL_READY_KEY = "konglish.translation-models-ready";

type TranscriptEntry = {
  ko: string;
  en: string;
  timestamp: string;
};

export default function HomeScreen() {
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
  const [sessionTranscript, setSessionTranscript] = useState<TranscriptEntry[]>(
    [],
  );
  const modelReadyRef = useRef(false);
  const shouldListenRef = useRef(true);
  const isStartingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const translationRequestRef = useRef(0);
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
      const voiceModule = NativeModules.Voice as
        | { isSpeechAvailable?: unknown }
        | null
        | undefined;

      if (!voiceModule || typeof voiceModule.isSpeechAvailable !== "function") {
        const message =
          "Speech recognition is not included in this app build. Install a new Konglish development build with the native voice module, then try again.";
        shouldListenRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsListeningEnabled(false);
        setSpeechError(message);
        setSpeechStatus("Speech recognition module unavailable");
        Alert.alert("App update required", message, [{ text: "OK" }]);
        return false;
      }

      let microphonePermission = await getRecordingPermissionsAsync();
      if (!microphonePermission.granted) {
        microphonePermission = await requestRecordingPermissionsAsync();
      }

      if (!microphonePermission.granted) {
        showSettingsPrompt(
          "Microphone access needed",
          "Konglish needs microphone access to transcribe and translate spoken Korean. Enable microphone access in Settings to continue.",
          microphonePermission.canAskAgain,
        );
        return false;
      }

      const speechRecognitionAvailable = await Voice.isAvailable();
      if (!speechRecognitionAvailable) {
        showSettingsPrompt(
          "Speech recognition access needed",
          "Konglish needs speech-recognition access to transcribe spoken Korean. Enable Speech Recognition for Konglish in Settings to continue.",
          false,
        );
        return false;
      }

      return true;
    };

    const scheduleRestart = () => {
      if (!isMounted || !shouldListenRef.current || restartTimeout) return;

      restartTimeout = setTimeout(() => {
        restartTimeout = null;
        void startListening();
      }, 600);
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

        await Voice.start("ko-KR");
        if (isMounted && shouldListenRef.current) {
          isRecordingRef.current = true;
          setIsRecording(true);
          setSpeechStatus("Listening for Korean speech...");
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

    const handleSpeechPartialResults = async (event: SpeechResultsEvent) => {
      const recognizedKorean = event.value?.[0];
      if (!recognizedKorean || !modelReadyRef.current) return;

      const requestId = ++translationRequestRef.current;
      setKoreanText(recognizedKorean);
      try {
        const result = await TranslateText.translate({
          text: recognizedKorean,
          sourceLanguage: TranslateLanguage.KOREAN,
          targetLanguage: TranslateLanguage.ENGLISH,
          downloadModelIfNeeded: false,
        });
        if (requestId === translationRequestRef.current) {
          setEnglishText(result as string);
        }
      } catch (error) {
        console.error("Local translation failed:", error);
      }
    };

    const handleSpeechResults = async (event: SpeechResultsEvent) => {
      const finalKorean = event.value?.[0];
      if (!finalKorean || !modelReadyRef.current) return;

      try {
        const finalEnglish = await TranslateText.translate({
          text: finalKorean,
          sourceLanguage: TranslateLanguage.KOREAN,
          targetLanguage: TranslateLanguage.ENGLISH,
          downloadModelIfNeeded: false,
        });
        setKoreanText(finalKorean);
        setEnglishText(finalEnglish as string);
        setSessionTranscript((entries) => [
          ...entries,
          {
            ko: finalKorean,
            en: finalEnglish as string,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } catch (error) {
        console.error("Could not commit translated sentence:", error);
      }
    };

    Voice.onSpeechPartialResults = handleSpeechPartialResults;
    Voice.onSpeechResults = handleSpeechResults;
    Voice.onSpeechStart = () => {
      isRecordingRef.current = true;
      setIsRecording(true);
      setSpeechError(null);
      setSpeechStatus("Listening for Korean speech...");
    };
    Voice.onSpeechEnd = () => {
      isRecordingRef.current = false;
      setIsRecording(false);
      soundLevel.setValue(0);
      if (shouldListenRef.current) {
        setSpeechStatus("Listening paused; restarting microphone...");
        scheduleRestart();
      }
    };
    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      const errorPayload: unknown = event.error;
      const message =
        (typeof errorPayload === "string" && errorPayload) ||
        (errorPayload &&
        typeof errorPayload === "object" &&
        "message" in errorPayload &&
        typeof errorPayload.message === "string"
          ? errorPayload.message
          : null) ||
        (errorPayload &&
        typeof errorPayload === "object" &&
        "code" in errorPayload &&
        typeof errorPayload.code === "string"
          ? errorPayload.code
          : null) ||
        "Speech recognition stopped unexpectedly.";
      console.error("Speech recognition failed:", message);
      isRecordingRef.current = false;
      setIsRecording(false);
      soundLevel.setValue(0);

      if (/permission|denied|not allowed|not available/i.test(message)) {
        shouldListenRef.current = false;
        setIsListeningEnabled(false);
        setSpeechError(
          /permission|denied|not allowed/i.test(message)
            ? "Allow microphone and speech-recognition access in device settings, then tap Start listening."
            : "Speech recognition is unavailable on this device right now. Tap Start listening to retry.",
        );
        setSpeechStatus(
          /permission|denied|not allowed/i.test(message)
            ? "Microphone permission is required"
            : "Speech recognition is unavailable",
        );
      } else if (shouldListenRef.current) {
        setSpeechStatus("Speech paused; restarting microphone...");
        scheduleRestart();
      } else {
        setSpeechStatus("Listening stopped");
      }
    };
    Voice.onSpeechVolumeChanged = (event) => {
      const level = Math.max(0, Math.min(1, (event.value ?? 0) / 10));
      Animated.timing(soundLevel, {
        toValue: level,
        duration: 100,
        useNativeDriver: true,
      }).start();
    };

    retryProvisionRef.current();

    return () => {
      isMounted = false;
      shouldListenRef.current = false;
      if (restartTimeout) clearTimeout(restartTimeout);
      void Voice.destroy()
        .catch(() => undefined)
        .finally(() => Voice.removeAllListeners());
    };
  }, [soundLevel]);

  const toggleListening = async () => {
    if (!modelReadyRef.current) return;

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsListeningEnabled(false);
      setSpeechError(null);
      setSpeechStatus("Listening stopped");
      try {
        await Voice.stop();
      } catch (error) {
        console.error("Voice engine stop failed:", error);
      }
    } else {
      shouldListenRef.current = true;
      setIsListeningEnabled(true);
      setKoreanText("");
      setEnglishText("");
      setSpeechError(null);
      void startListeningRef.current();
    }
  };

  const exportSessionLog = async () => {
    if (sessionTranscript.length === 0 && !koreanText) {
      Alert.alert("Empty session", "There is no transcript to export yet.");
      return;
    }

    const completedEntries = sessionTranscript
      .map(
        (entry, index) =>
          `[Sentence ${index + 1} - ${entry.timestamp}]\nKR: ${entry.ko}\nEN: ${entry.en}`,
      )
      .join("\n\n");
    const currentEntry = koreanText
      ? `[Current stream${isRecording ? " - Live" : ""}]\nKR: ${koreanText}\nEN: ${englishText || "Translation pending"}`
      : "";
    const content = [
      "--- TRANSLATION SESSION LOG ---",
      completedEntries,
      currentEntry,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const file = new File(Paths.document, `Transcript_${Date.now()}.txt`);
      file.create({ overwrite: true });
      file.write(content, { encoding: "utf8" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: "Export translation transcript",
          mimeType: "text/plain",
          UTI: "public.plain-text",
        });
      } else {
        Alert.alert("Export complete", `Transcript saved at ${file.uri}`);
      }
    } catch (error) {
      console.error("Transcript export failed:", error);
      Alert.alert("Export failed", "The transcript file could not be created.");
    }
  };

  if (!isModelReady) {
    return (
      <SafeAreaView style={styles.setupScreen}>
        {modelError ? null : <ActivityIndicator size="large" color="#186B52" />}
        <View style={styles.setupCopy}>
          <Text style={styles.eyebrow}>KONGLISH / OFFLINE SETUP</Text>
          <Text style={styles.setupTitle}>
            {modelError
              ? "Translation is not ready"
              : "Preparing your translator"}
          </Text>
          <Text style={styles.setupMessage}>
            {modelError ?? downloadProgressMessage}
          </Text>
          <Text style={styles.setupNote}>
            The language files are saved on this device after the first
            download.
          </Text>
        </View>
        {modelError && Platform.OS !== "web" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => retryProvisionRef.current()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry download</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KONGLISH / LIVE</Text>
          <Text style={styles.title}>Korean, in the moment.</Text>
        </View>
        <View style={styles.readyMark}>
          <Text style={styles.readyMarkText}>KO / EN</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !isModelReady }}
          onPress={() => void toggleListening()}
          style={[
            styles.listenButton,
            isRecording && styles.listenButtonActive,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.soundPulse,
              {
                opacity: soundLevel.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.42],
                }),
                transform: [
                  {
                    scale: soundLevel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2.8],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.listenDot} />
          <Text style={styles.listenButtonText}>
            {isListeningEnabled ? "Stop listening" : "Start listening"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void exportSessionLog()}
          style={styles.exportButton}
        >
          <Text style={styles.exportButtonText}>Export .txt</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.streamDisplay}
        contentContainerStyle={styles.streamContent}
      >
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

        {sessionTranscript.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={styles.historyHeader}>Completed sentences</Text>
            {sessionTranscript.map((entry, index) => (
              <View
                key={`${entry.timestamp}-${index}`}
                style={styles.historyRow}
              >
                <Text style={styles.historyMeta}>
                  Sentence {index + 1} · {entry.timestamp}
                </Text>
                <Text style={styles.historyKo}>KR: {entry.ko}</Text>
                <Text style={styles.historyEn}>EN: {entry.en}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.onlineDot, !isRecording && styles.offlineDot]} />
        <View style={styles.footerCopy}>
          <Text style={styles.footerText}>{speechStatus}</Text>
          {speechError ? (
            <Text style={styles.speechError}>{speechError}</Text>
          ) : null}
        </View>
      </View>
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
  setupScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#F3F5F0",
  },
  setupCopy: {
    alignItems: "center",
    marginTop: 26,
  },
  eyebrow: {
    color: "#527468",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  setupTitle: {
    color: "#15241E",
    fontSize: 26,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  setupMessage: {
    color: "#53645D",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  setupNote: {
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 34,
  },
  title: {
    color: "#15241E",
    fontSize: 26,
    fontWeight: "700",
    marginTop: 8,
  },
  readyMark: {
    alignItems: "center",
    backgroundColor: "#E2EAE3",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10,
  },
  readyMarkText: {
    color: "#186B52",
    fontSize: 11,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  listenButton: {
    position: "relative",
    overflow: "hidden",
    flex: 1,
    alignItems: "center",
    backgroundColor: "#186B52",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 56,
    gap: 10,
  },
  listenButtonActive: {
    backgroundColor: "#A53A31",
  },
  listenDot: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  soundPulse: {
    position: "absolute",
    width: 14,
    height: 14,
    left: "27%",
    borderRadius: 7,
    backgroundColor: "#A7E5C9",
  },
  listenButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  exportButton: {
    alignItems: "center",
    backgroundColor: "#334B42",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 16,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  streamDisplay: {
    flex: 1,
  },
  streamContent: {
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
  footer: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginTop: "auto",
    paddingBottom: 20,
  },
  footerCopy: {
    flex: 1,
  },
  onlineDot: {
    backgroundColor: "#35936B",
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  offlineDot: {
    backgroundColor: "#A53A31",
    marginTop: 5,
  },
  footerText: {
    color: "#718078",
    fontSize: 12,
  },
  speechError: {
    color: "#A53A31",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
