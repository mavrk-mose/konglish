import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import TranslateText, {
    TranslateLanguage,
} from "@react-native-ml-kit/translate-text";

const MODEL_READY_KEY = "konglish.translation-models-ready";

export function useTranslationModels() {
  const [isReady, setIsReady] = useState(false);
  const [progressMessage, setProgressMessage] = useState(
    "Checking on-device English and Korean language files...",
  );
  const [error, setError] = useState<string | null>(null);
  const provisionModelsRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isMounted = true;

    const provisionModels = async () => {
      setError(null);

      if (Platform.OS === "web") {
        setError(
          "Offline translation requires an iOS or Android development build.",
        );
        return;
      }

      try {
        const wasProvisioned = await AsyncStorage.getItem(MODEL_READY_KEY);
        if (!isMounted) return;
        if (wasProvisioned === "true") {
          setIsReady(true);
          return;
        }

        setProgressMessage(
          "Preparing on-device English and Korean language files...",
        );
        await TranslateText.translate({
          text: "안녕",
          sourceLanguage: TranslateLanguage.KOREAN,
          targetLanguage: TranslateLanguage.ENGLISH,
          downloadModelIfNeeded: true,
        });
        await AsyncStorage.setItem(MODEL_READY_KEY, "true");

        if (isMounted) setIsReady(true);
      } catch (provisionError) {
        console.error("Failed to provision local ML models:", provisionError);
        if (isMounted) {
          setError(
            "Required translation packs could not be downloaded. Check your internet connection and try again.",
          );
        }
      }
    };

    provisionModelsRef.current = provisionModels;
    void provisionModels();

    return () => {
      isMounted = false;
    };
  }, []);

  const retry = useCallback(() => {
    setProgressMessage(
      "Preparing on-device English and Korean language files...",
    );
    void provisionModelsRef.current();
  }, []);

  return { isReady, progressMessage, error, retry };
}
