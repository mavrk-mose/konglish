import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform } from "react-native";

import TranslateText, {
    TranslateLanguage,
} from "@react-native-ml-kit/translate-text";
import {
    ExpoSpeechRecognitionModule,
    type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

import type { TranscriptEntry } from "@/types/transcript";
import type { TranslationDirection } from "@/types/translation";

const SPEECH_STABILITY_DELAY_MS = 400;
const FINAL_DUPLICATE_WINDOW_MS = 2500;
const UTTERANCE_SILENCE_MS = 1200;

type SpeechTranslationOptions = {
  enabled: boolean;
  direction?: TranslationDirection;
  initialSequence: number;
  onTranscriptComplete: (entry: TranscriptEntry) => void;
};

export function useSpeechTranslation({
  enabled,
  direction = "ko-to-en",
  initialSequence,
  onTranscriptComplete,
}: SpeechTranslationOptions) {
  const [sourceText, setSourceText] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [translationError, setTranslationError] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListeningEnabled, setIsListeningEnabled] = useState(true);
  const [status, setStatus] = useState("Starting microphone...");
  const [error, setError] = useState<string | null>(null);
  const [soundLevel] = useState(() => new Animated.Value(0));
  const enabledRef = useRef(enabled);
  const directionRef = useRef(direction);
  const activeRecognitionDirectionRef = useRef(direction);
  const directionGenerationRef = useRef(0);
  const shouldListenRef = useRef(true);
  const isStartingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const translationRequestRef = useRef(0);
  const latestSourceTextRef = useRef("");
  const pendingInterimTextRef = useRef("");
  const stabilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const utteranceSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
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
  const transcriptSequenceRef = useRef(initialSequence);
  const onDeviceRecognitionAvailableRef = useRef<boolean | null>(null);
  const usingOnDeviceRecognitionRef = useRef(false);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) void startListeningRef.current();
  }, [enabled]);

  useEffect(() => {
    if (directionRef.current === direction) return;

    directionRef.current = direction;
    directionGenerationRef.current += 1;
    translationRequestRef.current += 1;
    latestSourceTextRef.current = "";
    pendingInterimTextRef.current = "";
    recentFinalTextsRef.current.clear();
    lastTranslatedTextRef.current = "";
    lastTranslationResultRef.current = null;
    inFlightTranslationsRef.current.clear();
    if (stabilityTimeoutRef.current) {
      clearTimeout(stabilityTimeoutRef.current);
      stabilityTimeoutRef.current = null;
    }
    if (utteranceSilenceTimeoutRef.current) {
      clearTimeout(utteranceSilenceTimeoutRef.current);
      utteranceSilenceTimeoutRef.current = null;
    }
    setSourceText("");
    setTranslationText("");
    setTranslationError(false);

    if (!enabledRef.current || !shouldListenRef.current) return;
    if (isRecordingRef.current) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (stopError) {
        console.error("Voice engine stop failed:", stopError);
      }
    } else if (!isStartingRef.current) {
      void startListeningRef.current();
    }
  }, [direction]);

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
      setError(message);
      setStatus("Microphone permission is required");

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
            void Linking.openSettings().catch((settingsError: unknown) => {
              console.error("Could not open device settings:", settingsError);
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
          "Konglish needs microphone and speech-recognition access to transcribe and translate speech. Enable both permissions in Settings to continue.",
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
      } catch (localeError) {
        onDeviceRecognitionAvailableRef.current = false;
        if (__DEV__) {
          console.warn(
            "[Speech] Could not check offline Korean model:",
            localeError,
          );
        }
      }

      return onDeviceRecognitionAvailableRef.current;
    };

    const startListening = async () => {
      if (
        !isMounted ||
        !enabledRef.current ||
        !shouldListenRef.current ||
        isStartingRef.current ||
        isRecordingRef.current
      ) {
        return;
      }

      const requestedDirection = directionRef.current;
      if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
      }

      isStartingRef.current = true;
      setError(null);
      setStatus("Requesting microphone and speech recognition...");

      try {
        const hasPermissions = await ensureRecordingPermissions();
        if (!hasPermissions) return;
        if (requestedDirection !== directionRef.current) return;

        const requiresOnDeviceRecognition =
          requestedDirection === "ko-to-en"
            ? await canUseOnDeviceKoreanRecognition()
            : false;
        if (!isMounted || !shouldListenRef.current) return;
        if (requestedDirection !== directionRef.current) return;
        usingOnDeviceRecognitionRef.current = requiresOnDeviceRecognition;
        if (__DEV__) {
          console.log(
            `[Speech] Using ${requiresOnDeviceRecognition ? "on-device Korean" : "the default"} recognizer.`,
          );
        }

        activeRecognitionDirectionRef.current = requestedDirection;
        ExpoSpeechRecognitionModule.start({
          lang: requestedDirection === "ko-to-en" ? "ko-KR" : "en-US",
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
          setStatus(
            `Starting ${requestedDirection === "ko-to-en" ? "Korean" : "English"} speech recognition...`,
          );
        }
      } catch (startError) {
        const message =
          startError instanceof Error
            ? startError.message
            : "Could not start speech recognition.";
        console.error("Voice engine start failed:", startError);
        isRecordingRef.current = false;
        shouldListenRef.current = false;
        if (isMounted) {
          setIsRecording(false);
          setIsListeningEnabled(false);
          setError(message);
          setStatus("Microphone could not start");
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
        if (
          isMounted &&
          enabledRef.current &&
          shouldListenRef.current &&
          requestedDirection !== directionRef.current
        ) {
          void startListening();
        }
      }
    };

    startListeningRef.current = startListening;

    const updateSourceTranscript = (text: string) => {
      if (latestSourceTextRef.current === text) return;
      latestSourceTextRef.current = text;
      setSourceText((current) => (current === text ? current : text));
      translationRequestRef.current += 1;
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
      setTranslationText((current) =>
        current === translation ? current : translation,
      );
      setTranslationError(false);
      if (__DEV__) {
        console.log(`[Translation] result: ${text} => ${translation}`);
      }
      return true;
    };

    const translateSourceText = async (sourceText: string) => {
      const text = sourceText.trim().replace(/\s+/gu, " ");
      if (!text || !enabledRef.current) return null;

      const currentDirection = directionRef.current;
      const requestId = ++translationRequestRef.current;
      setTranslationError(false);
      const cachedTranslation = lastTranslationResultRef.current;
      if (cachedTranslation?.text === text) {
        if (__DEV__) {
          console.log(`[Translation] skipped duplicate: ${text}`);
        }
        if (isMounted && requestId === translationRequestRef.current) {
          setTranslationText((current) =>
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
        } catch (translationError) {
          if (__DEV__) {
            console.warn("[Translation] failed:", translationError);
          }
          if (requestId === translationRequestRef.current) {
            setTranslationError(true);
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
        sourceLanguage:
          currentDirection === "ko-to-en"
            ? TranslateLanguage.KOREAN
            : TranslateLanguage.ENGLISH,
        targetLanguage:
          currentDirection === "ko-to-en"
            ? TranslateLanguage.ENGLISH
            : TranslateLanguage.KOREAN,
        downloadModelIfNeeded: false,
      }).then((result) => result as string);
      inFlightTranslationsRef.current.set(text, translationPromise);

      try {
        const translation = await translationPromise;
        applyTranslation(requestId, text, translation);
        return translation;
      } catch (translationError) {
        if (
          requestId === translationRequestRef.current &&
          lastTranslatedTextRef.current === text
        ) {
          lastTranslatedTextRef.current = "";
        }
        console.warn("[Translation] failed:", translationError);
        if (requestId === translationRequestRef.current) {
          setTranslationError(true);
        }
        return null;
      } finally {
        if (inFlightTranslationsRef.current.get(text) === translationPromise) {
          inFlightTranslationsRef.current.delete(text);
        }
      }
    };

    const finalizeRecognizedText = async (
      text: string,
      reason: "final" | "pause" | "punctuation",
    ) => {
      const normalizedText = text.trim().replace(/\s+/gu, " ");
      if (!normalizedText || !enabledRef.current) return;

      const resultDirection = directionRef.current;
      if (resultDirection !== activeRecognitionDirectionRef.current) return;
      const directionGeneration = directionGenerationRef.current;

      const now = Date.now();
      for (const [candidate, timestamp] of recentFinalTextsRef.current) {
        if (now - timestamp > FINAL_DUPLICATE_WINDOW_MS) {
          recentFinalTextsRef.current.delete(candidate);
        }
      }

      const duplicateKey = normalizedText.toLowerCase();
      if (recentFinalTextsRef.current.has(duplicateKey)) {
        if (__DEV__) {
          console.log(`[Translation] skipped duplicate: ${normalizedText}`);
        }
        return;
      }

      const isNewUtterance = pendingInterimTextRef.current.length === 0;
      recentFinalTextsRef.current.set(duplicateKey, now);
      updateSourceTranscript(normalizedText);
      if (isNewUtterance) {
        setTranslationText("");
        setTranslationError(false);
      }
      pendingInterimTextRef.current = "";
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
        stabilityTimeoutRef.current = null;
      }
      if (utteranceSilenceTimeoutRef.current) {
        clearTimeout(utteranceSilenceTimeoutRef.current);
        utteranceSilenceTimeoutRef.current = null;
      }
      if (__DEV__) {
        console.log(`[Speech] finalize (${reason}): ${normalizedText}`);
      }

      const sequence = ++transcriptSequenceRef.current;
      const timestamp = new Date(now).toLocaleTimeString("en-GB", {
        hour12: false,
      });
      const translation = await translateSourceText(normalizedText);
      if (
        !isMounted ||
        translation === null ||
        directionGeneration !== directionGenerationRef.current
      ) {
        return;
      }

      onTranscriptComplete({
        id: `${now}-${sequence}`,
        sequence,
        ko: resultDirection === "ko-to-en" ? normalizedText : translation,
        en: resultDirection === "ko-to-en" ? translation : normalizedText,
        timestamp,
      });
    };

    const handleSpeechResults = async (
      event: ExpoSpeechRecognitionResultEvent,
    ) => {
      const recognizedText = event.results[0]?.transcript
        ?.trim()
        .replace(/\s+/gu, " ");
      if (!recognizedText || !enabledRef.current) return;

      const resultDirection = directionRef.current;
      if (resultDirection !== activeRecognitionDirectionRef.current) return;

      if (event.isFinal) {
        await finalizeRecognizedText(recognizedText, "final");
        return;
      }

      if (__DEV__) {
        console.log(`[Speech] interim: ${recognizedText}`);
      }
      if (pendingInterimTextRef.current === recognizedText) return;

      const isNewUtterance = pendingInterimTextRef.current.length === 0;
      pendingInterimTextRef.current = recognizedText;
      updateSourceTranscript(recognizedText);
      if (isNewUtterance) {
        setTranslationText("");
        setTranslationError(false);
      }
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
      }
      stabilityTimeoutRef.current = setTimeout(() => {
        stabilityTimeoutRef.current = null;
        if (
          pendingInterimTextRef.current !== recognizedText ||
          latestSourceTextRef.current !== recognizedText ||
          !shouldListenRef.current
        ) {
          return;
        }

        void translateSourceText(recognizedText);
      }, SPEECH_STABILITY_DELAY_MS);

      const endsWithBoundary = /[.!?]$/u.test(recognizedText.trim());
      if (endsWithBoundary) {
        if (utteranceSilenceTimeoutRef.current) {
          clearTimeout(utteranceSilenceTimeoutRef.current);
        }
        utteranceSilenceTimeoutRef.current = setTimeout(() => {
          if (
            shouldListenRef.current &&
            pendingInterimTextRef.current === recognizedText &&
            latestSourceTextRef.current === recognizedText
          ) {
            void finalizeRecognizedText(recognizedText, "punctuation");
          }
        }, UTTERANCE_SILENCE_MS);
        return;
      }

      if (utteranceSilenceTimeoutRef.current) {
        clearTimeout(utteranceSilenceTimeoutRef.current);
      }
      utteranceSilenceTimeoutRef.current = setTimeout(() => {
        if (
          shouldListenRef.current &&
          pendingInterimTextRef.current === recognizedText &&
          latestSourceTextRef.current === recognizedText
        ) {
          void finalizeRecognizedText(recognizedText, "pause");
        }
      }, UTTERANCE_SILENCE_MS);
    };

    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener("result", handleSpeechResults),
      ExpoSpeechRecognitionModule.addListener("start", () => {
        isStartingRef.current = false;
        isRecordingRef.current = true;
        setIsRecording(true);
        setError(null);
        setStatus(
          `Listening for ${directionRef.current === "ko-to-en" ? "Korean" : "English"} speech...`,
        );
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => {
        isStartingRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
        soundLevel.setValue(0);
        if (utteranceSilenceTimeoutRef.current) {
          clearTimeout(utteranceSilenceTimeoutRef.current);
          utteranceSilenceTimeoutRef.current = null;
        }
        if (shouldListenRef.current) {
          setStatus("Listening paused; restarting microphone...");
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
          setStatus("Switching to the default speech recognizer...");
          scheduleRestart(100);
        } else if (event.error === "aborted") {
          if (shouldListenRef.current) scheduleRestart();
        } else if (
          event.error === "no-speech" ||
          event.error === "speech-timeout"
        ) {
          if (shouldListenRef.current) {
            setStatus("No speech heard; continuing to listen...");
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
          setError(
            "No speech recognition service is available on this device.",
          );
          setStatus("Speech recognition unavailable");
        } else if (shouldListenRef.current) {
          console.warn("Speech recognition failed:", event.error, message);
          setStatus("Speech paused; restarting microphone...");
          scheduleRestart(1000);
        } else {
          console.warn("Speech recognition stopped:", event.error, message);
          setStatus(message || "Listening stopped");
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

    if (enabledRef.current) void startListening();

    return () => {
      isMounted = false;
      shouldListenRef.current = false;
      if (restartTimeout) clearTimeout(restartTimeout);
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
        stabilityTimeoutRef.current = null;
      }
      if (utteranceSilenceTimeoutRef.current) {
        clearTimeout(utteranceSilenceTimeoutRef.current);
        utteranceSilenceTimeoutRef.current = null;
      }
      ExpoSpeechRecognitionModule.abort();
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [onTranscriptComplete, soundLevel]);

  const toggleListening = async () => {
    if (!enabledRef.current) return;

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
        stabilityTimeoutRef.current = null;
      }
      if (utteranceSilenceTimeoutRef.current) {
        clearTimeout(utteranceSilenceTimeoutRef.current);
        utteranceSilenceTimeoutRef.current = null;
      }
      pendingInterimTextRef.current = "";
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsListeningEnabled(false);
      setError(null);
      setStatus("Listening stopped");
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (stopError) {
        console.error("Voice engine stop failed:", stopError);
      }
    } else {
      shouldListenRef.current = true;
      setIsListeningEnabled(true);
      latestSourceTextRef.current = "";
      pendingInterimTextRef.current = "";
      recentFinalTextsRef.current.clear();
      translationRequestRef.current += 1;
      setSourceText("");
      setTranslationText("");
      setTranslationError(false);
      setError(null);
      void startListeningRef.current();
    }
  };

  return {
    sourceText,
    translationText,
    translationError,
    isRecording,
    isListeningEnabled,
    status,
    error,
    soundLevel,
    toggleListening,
  };
}
