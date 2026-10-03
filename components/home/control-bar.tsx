import { Mic, Settings } from "lucide-react-native";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

type ControlBarProps = {
  theme: ScreenTheme;
  currentLanguageLabel: string;
  isRecording: boolean;
  languageAnimatedOpacity: Animated.Value;
  soundLevel: Animated.Value;
  onOpenSettings: () => void;
  onToggleDirection: () => void;
  onToggleListening: () => void;
};

export function ControlBar({
  theme,
  currentLanguageLabel,
  isRecording,
  languageAnimatedOpacity,
  soundLevel,
  onOpenSettings,
  onToggleDirection,
  onToggleListening,
}: ControlBarProps) {
  return (
    <View style={styles.bottomBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={onOpenSettings}
        style={[styles.controlButton, { backgroundColor: theme.panelAlt }]}
      >
        <Settings color={theme.primary} size={23} strokeWidth={2} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch language"
        onPress={onToggleDirection}
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
        accessibilityLabel={
          isRecording ? "Stop recording" : "Start recording"
        }
        onPress={onToggleListening}
        style={[
          styles.micButton,
          {
            backgroundColor: theme.panelAlt,
            shadowColor: theme.shadow,
            borderWidth: isRecording ? 1 : 0,
            borderColor: isRecording ? theme.accent : undefined,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.micInner,
            {
              transform: [
                {
                  scale: isRecording
                    ? soundLevel.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                        extrapolate: "clamp",
                      })
                    : 1,
                },
              ],
              backgroundColor: isRecording ? theme.danger : theme.buttonBg,
              shadowColor: isRecording ? theme.danger : theme.shadow,
              shadowOpacity: isRecording ? 0.45 : 0.12,
              shadowRadius: isRecording ? 10 : 8,
              shadowOffset: { width: 0, height: 4 },
            },
          ]}
        >
          <Mic
            color={isRecording ? "#fff" : theme.buttonText}
            size={24}
            strokeWidth={2}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
