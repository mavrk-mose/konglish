import { History } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

type LiveTranslationDisplayProps = {
  theme: ScreenTheme;
  fontSize: number;
  transcriptText: string;
  translatedText: string;
  onOpenHistory: () => void;
};

export function LiveTranslationDisplay({
  theme,
  fontSize,
  transcriptText,
  translatedText,
  onOpenHistory,
}: LiveTranslationDisplayProps) {
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
});
