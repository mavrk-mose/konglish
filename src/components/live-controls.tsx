import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import type { TranslationDirection } from "@/types/translation";

type LiveControlsProps = {
  direction: TranslationDirection;
  isRecording: boolean;
  isListeningEnabled: boolean;
  soundLevel: Animated.Value;
  onDirectionChange: (direction: TranslationDirection) => void;
  onToggleListening: () => void;
  onExport: () => void;
};

export function LiveControls({
  direction,
  isRecording,
  isListeningEnabled,
  soundLevel,
  onDirectionChange,
  onToggleListening,
  onExport,
}: LiveControlsProps) {
  return (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KONGLISH / LIVE</Text>
          <Text style={styles.title}>Korean and English, live.</Text>
        </View>
        <View style={styles.readyMark}>
          <Text style={styles.readyMarkText}>KO / EN</Text>
        </View>
      </View>

      <View style={styles.directionSection}>
        <Text style={styles.directionLabel}>Translation direction</Text>
        <View style={styles.directionPicker}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Translate Korean to English"
            accessibilityState={{ selected: direction === "ko-to-en" }}
            onPress={() => onDirectionChange("ko-to-en")}
            style={[
              styles.directionOption,
              direction === "ko-to-en" && styles.directionOptionSelected,
            ]}
          >
            <Text
              style={[
                styles.directionOptionText,
                direction === "ko-to-en" && styles.directionOptionTextSelected,
              ]}
            >
              Korean to English
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Translate English to Korean"
            accessibilityState={{ selected: direction === "en-to-ko" }}
            onPress={() => onDirectionChange("en-to-ko")}
            style={[
              styles.directionOption,
              direction === "en-to-ko" && styles.directionOptionSelected,
            ]}
          >
            <Text
              style={[
                styles.directionOptionText,
                direction === "en-to-ko" && styles.directionOptionTextSelected,
              ]}
            >
              English to Korean
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onToggleListening}
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
          onPress={onExport}
          style={styles.exportButton}
        >
          <Text style={styles.exportButtonText}>Export .txt</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  eyebrow: {
    color: "#527468",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
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
  directionSection: {
    marginBottom: 18,
  },
  directionLabel: {
    color: "#718078",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 7,
    textTransform: "uppercase",
  },
  directionPicker: {
    backgroundColor: "#E2EAE3",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  directionOption: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 6,
  },
  directionOptionSelected: {
    backgroundColor: "#FFFFFF",
  },
  directionOptionText: {
    color: "#53645D",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  directionOptionTextSelected: {
    color: "#186B52",
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
});
