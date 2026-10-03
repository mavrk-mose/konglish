import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];
type ThemeMode = "light" | "dark";
type FontSizeMode = "small" | "medium" | "large";

type SettingsSheetProps = {
  visible: boolean;
  theme: ScreenTheme;
  themeMode: ThemeMode;
  fontSizeMode: FontSizeMode;
  settingsSlide: Animated.Value;
  onDismiss: () => void;
  onToggleTheme: () => void;
  onSetFontSize: (size: FontSizeMode) => void;
  onDeleteAllHistory: () => void;
};

export function SettingsSheet({
  visible,
  theme,
  themeMode,
  fontSizeMode,
  settingsSlide,
  onDismiss,
  onToggleTheme,
  onSetFontSize,
  onDeleteAllHistory,
}: SettingsSheetProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
      <Animated.View
        style={[
          styles.modalSheet,
          {
            backgroundColor: theme.panel,
            transform: [{ translateY: settingsSlide }],
          },
        ]}
      >
        <Text style={[styles.sheetTitle, { color: theme.primary }]}>Settings</Text>

        <View style={styles.settingSection}>
          <Text style={[styles.settingLabel, { color: theme.secondary }]}>Appearance</Text>
          <View style={[styles.settingRow, { backgroundColor: theme.panelAlt }]}>
            <Text style={[styles.settingText, { color: theme.primary }]}>
              {themeMode === "dark" ? "Dark mode" : "Light mode"}
            </Text>
            <Pressable
              onPress={onToggleTheme}
              style={[
                styles.switch,
                {
                  backgroundColor:
                    themeMode === "dark" ? theme.accent : theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  {
                    transform: [
                      { translateX: themeMode === "dark" ? 20 : 0 },
                    ],
                  },
                ]}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={[styles.settingLabel, { color: theme.secondary }]}>Font size</Text>
          <View
            style={[styles.segmentedControl, { backgroundColor: theme.panelAlt }]}
          >
            {(["small", "medium", "large"] as FontSizeMode[]).map((size) => (
              <Pressable
                key={size}
                onPress={() => onSetFontSize(size)}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor:
                      fontSizeMode === size ? theme.buttonBg : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        fontSizeMode === size ? theme.buttonText : theme.primary,
                    },
                  ]}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={onDeleteAllHistory}
          style={[styles.dangerButton, { backgroundColor: theme.panelAlt }]}
        >
          <Text style={[styles.dangerText, { color: theme.danger }]}>
            Delete all history
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: "75%",
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  settingSection: {
    marginTop: 16,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 1,
  },
  settingRow: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingText: {
    fontSize: 16,
    fontWeight: "600",
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  segmentedControl: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
  },
  dangerButton: {
    marginTop: 22,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
