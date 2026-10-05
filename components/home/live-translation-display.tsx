import * as Clipboard from "expo-clipboard";
import { History } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

type LiveTranslationDisplayProps = {
  theme: ScreenTheme;
  fontSize: number;
  transcriptText: string;
  translatedText: string;
  canCopyTranslation: boolean;
  onOpenHistory: () => void;
};

export function LiveTranslationDisplay({
  theme,
  fontSize,
  transcriptText,
  translatedText,
  canCopyTranslation,
  onOpenHistory,
}: LiveTranslationDisplayProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    [],
  );

  const copyTranslation = async () => {
    if (!canCopyTranslation) return;

    try {
      await Clipboard.setStringAsync(translatedText);
      setCopiedText(translatedText);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => {
        setCopiedText(null);
        copyTimeout.current = null;
      }, 1500);
    } catch (error) {
      console.error("Failed to copy translation", error);
      Alert.alert("Couldn't copy translation", "Please try again.");
    }
  };

  return (
    <>
      <View style={styles.topRow}>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open history"
          onPress={onOpenHistory}
          style={[styles.iconButton, { backgroundColor: theme.panelAlt }]}
        >
          <History 
            color={theme.primary} 
            size={21} 
            strokeWidth={2} 
          />
        </Pressable>
      </View>

      <View style={styles.liveArea}>
        <View style={styles.textBlock}>
          <Text
            style={[
              styles.mainText,
              { color: theme.primary, fontSize },
            ]}
          >
            {transcriptText}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              copiedText === translatedText
                ? "Translation copied"
                : "Copy translation"
            }
            accessibilityHint="Copies the translated text to the clipboard"
            accessibilityState={{ disabled: !canCopyTranslation }}
            disabled={!canCopyTranslation}
            onPress={() => void copyTranslation()}
          >
            <Text
              style={[
                styles.translationText,
                {
                  color: theme.secondary,
                  fontSize: fontSize * 0.9,
                },
              ]}
            >
              {translatedText}
            </Text>
            {copiedText === translatedText && (
              <Text style={[styles.copiedLabel, { color: theme.secondary }]}>
                Copied
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  liveArea: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 8,
  },
  textBlock: {
    justifyContent: "center",
    gap: 18,
    marginBottom: 18,
  },
  mainText: {
    fontWeight: "500",
    lineHeight: 32,
  },
  translationText: {
    fontWeight: "500",
    lineHeight: 28,
  },
  copiedLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
