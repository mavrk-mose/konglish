/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const AppTheme = {
  light: {
    background: "#f5f3ef",
    backgroundStrong: "#e9e4df",
    panel: "#f8f5f2",
    panelAlt: "#f0ece8",
    primary: "#111111",
    secondary: "#5e5a55",
    muted: "#8e8a84",
    border: "#d9d2cc",
    icon: "#1c1b1a",
    accent: "#1c7b68",
    accentSoft: "#dfece8",
    overlay: "rgba(17, 17, 17, 0.52)",
    buttonBg: "#1b1a1a",
    buttonText: "#f9f5f4",
    danger: "#b25146",
    success: "#3a8c63",
    shadow: "rgba(17, 17, 17, 0.12)",
  },
  dark: {
    background: "#050505",
    backgroundStrong: "#101010",
    panel: "#0f0f11",
    panelAlt: "#17191d",
    primary: "#f5f5f5",
    secondary: "#d7d7d7",
    muted: "#9c9c9c",
    border: "#2d2d2d",
    icon: "#f5f5f5",
    accent: "#f0f0f0",
    accentSoft: "#1a1a1a",
    overlay: "rgba(0, 0, 0, 0.72)",
    buttonBg: "#d9d9d9",
    buttonText: "#111111",
    danger: "#ff7d73",
    success: "#89d9b1",
    shadow: "rgba(0, 0, 0, 0.34)",
  },
} as const;

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
