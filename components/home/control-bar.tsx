import { Mic, Settings } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import ReanimatedAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AppTheme } from "@/constants/theme";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

const LABEL_HEIGHT = 24;
const TRAVEL = 22;

function SlidingLabel({ label, color }: { label: string; color: string }) {
  const [state, setState] = useState({
    current: label,
    previous: null as string | null,
    tick: 0,
  });
  const progress = useSharedValue(1);

  // Adjust state during render when the prop changes (no effect needed)
  if (label !== state.current) {
    setState({
      current: label,
      previous: state.current,
      tick: state.tick + 1,
    });
  }

  const clearPrevious = () => setState((s) => ({ ...s, previous: null }));

  // The effect only drives the animation; it never calls setState directly
  useEffect(() => {
    if (state.tick === 0) return;

    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: 280, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(clearPrevious);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tick]);

  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -TRAVEL * progress.value }],
  }));

  const inStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: TRAVEL * (1 - progress.value) }],
  }));

  return (
    <View style={styles.labelClip}>
      {/* invisible text keeps the button sized to the current label */}
      <ReanimatedAnimated.Text
        style={[styles.languageText, { opacity: 0 }]}
        numberOfLines={1}
      >
        {state.current}
      </ReanimatedAnimated.Text>

      {state.previous !== null && (
        <ReanimatedAnimated.Text
          numberOfLines={1}
          style={[
            styles.languageText,
            styles.labelAbsolute,
            { color },
            outStyle,
          ]}
        >
          {state.previous}
        </ReanimatedAnimated.Text>
      )}

      <ReanimatedAnimated.Text
        numberOfLines={1}
        style={[styles.languageText, styles.labelAbsolute, { color }, inStyle]}
      >
        {state.current}
      </ReanimatedAnimated.Text>
    </View>
  );
}

type ControlBarProps = {
  theme: ScreenTheme;
  currentLanguageLabel: string;
  isRecording: boolean;
  soundLevel: Animated.Value;
  onOpenSettings: () => void;
  onToggleDirection: () => void;
  onToggleListening: () => void;
};

export function ControlBar({
  theme,
  currentLanguageLabel,
  isRecording,
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
        <SlidingLabel label={currentLanguageLabel} color={theme.primary} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
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
  labelClip: {
    height: LABEL_HEIGHT,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  labelAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  languageText: {
    fontSize: 18,
    lineHeight: LABEL_HEIGHT,
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
