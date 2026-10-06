import * as Clipboard from "expo-clipboard";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createMMKV } from "react-native-mmkv";

import { AppTheme } from "@/constants/theme";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

export type TranslationItem = {
  id: string;
  transcript: string;
  translation: string;
};

type LiveTranslationDisplayProps = {
  theme: ScreenTheme;
  fontSize: number;
  transcriptText: string;
  translatedText: string;
  canCopyTranslation: boolean;
  hasLiveTranscript: boolean;
  finalizedSegments: TranslationItem[];
};

type TranslationRowProps = {
  item: TranslationItem;
  theme: ScreenTheme;
  fontSize: number;
  canCopy: boolean;
  isCopied: boolean;
  onCopy: (item: TranslationItem) => void;
};

const BOTTOM_THRESHOLD = 48;
const LIVE_HISTORY_STORAGE_KEY = "konglish.live-translation-history";
const liveHistoryStorage = createMMKV({ id: "konglish-live-history" });

function loadLiveHistory(): TranslationItem[] {
  try {
    const savedHistory = liveHistoryStorage.getString(LIVE_HISTORY_STORAGE_KEY);
    if (!savedHistory) return [];

    const parsedHistory: unknown = JSON.parse(savedHistory);
    if (!Array.isArray(parsedHistory)) return [];

    return parsedHistory.filter(
      (item): item is TranslationItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.transcript === "string" &&
        typeof item.translation === "string",
    );
  } catch (error) {
    console.warn("Could not load live translation history:", error);
    return [];
  }
}

const TranslationRow = memo(function TranslationRow({
  item,
  theme,
  fontSize,
  canCopy,
  isCopied,
  onCopy,
}: TranslationRowProps) {
  return (
    <View style={styles.messagePair}>
      {item.transcript.length > 0 && (
        <Text
          style={[
            styles.transcriptText,
            {
              color: theme.primary,
              fontSize,
              lineHeight: fontSize * 1.45,
            },
          ]}
        >
          {item.transcript}
        </Text>
      )}
      {item.translation.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isCopied ? "Translation copied" : "Copy translation"
          }
          accessibilityHint="Copies this translation to the clipboard"
          accessibilityState={{ disabled: !canCopy }}
          disabled={!canCopy}
          onPress={() => onCopy(item)}
        >
          <Text
            style={[
              styles.translationText,
              {
                color: theme.secondary,
                fontSize: fontSize * 0.9,
                lineHeight: fontSize * 1.3,
              },
            ]}
          >
            {item.translation}
          </Text>
          {isCopied && (
            <Text style={[styles.copiedLabel, { color: theme.secondary }]}>
              Copied
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
});

export function LiveTranslationDisplay({
  theme,
  fontSize,
  transcriptText,
  translatedText,
  canCopyTranslation,
  hasLiveTranscript,
  finalizedSegments,
}: LiveTranslationDisplayProps) {
  const [history, setHistory] = useState<TranslationItem[]>(loadLiveHistory);
  const [copiedItem, setCopiedItem] = useState<{
    id: string;
    translation: string;
  } | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const listRef = useRef<FlatList<TranslationItem>>(null);
  const processedIds = useRef(new Set<string>());
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    try {
      liveHistoryStorage.set(LIVE_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Could not save live translation history:", error);
    }
  }, [history]);

  useEffect(() => {
    const newSegments = finalizedSegments.filter((segment) => {
      if (processedIds.current.has(segment.id)) return false;
      processedIds.current.add(segment.id);
      return segment.transcript.trim().length > 0;
    });

    if (newSegments.length > 0) {
      setHistory((current) => [...current, ...newSegments]);
    }
  }, [finalizedSegments]);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    [],
  );

  const liveItem = useMemo<TranslationItem | null>(() => {
    if (!hasLiveTranscript || transcriptText.trim().length === 0) return null;

    const latestCompleted = history[history.length - 1];
    if (
      latestCompleted?.transcript === transcriptText &&
      latestCompleted.translation === translatedText
    ) {
      return null;
    }

    return {
      id: "live-current",
      transcript: transcriptText,
      translation: translatedText,
    };
  }, [
    hasLiveTranscript,
    history,
    transcriptText,
    translatedText,
  ]);

  const copyTranslation = useCallback(async (item: TranslationItem) => {
    if (!item.translation.trim()) return;

    try {
      await Clipboard.setStringAsync(item.translation);
      setCopiedItem({ id: item.id, translation: item.translation });
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => {
        setCopiedItem(null);
        copyTimeout.current = null;
      }, 1500);
    } catch (error) {
      console.error("Failed to copy translation", error);
      Alert.alert("Couldn't copy translation", "Please try again.");
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TranslationItem }) => (
      <TranslationRow
        item={item}
        theme={theme}
        fontSize={fontSize}
        canCopy
        isCopied={
          copiedItem?.id === item.id &&
          copiedItem?.translation === item.translation
        }
        onCopy={copyTranslation}
      />
    ),
    [copiedItem, copyTranslation, fontSize, theme],
  );

  const liveFooter = useMemo(
    () =>
      liveItem ? (
        <TranslationRow
          item={liveItem}
          theme={theme}
          fontSize={fontSize}
          canCopy={canCopyTranslation}
          isCopied={
            copiedItem?.id === liveItem.id &&
            copiedItem.translation === liveItem.translation
          }
          onCopy={copyTranslation}
        />
      ) : null,
    [canCopyTranslation, copiedItem, copyTranslation, fontSize, liveItem, theme],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const nearBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y <=
        BOTTOM_THRESHOLD;
      shouldAutoScroll.current = nearBottom;
      setShowJumpToLatest(!nearBottom);
    },
    [],
  );

  const handleContentSizeChange = useCallback(() => {
    if (shouldAutoScroll.current) {
      listRef.current?.scrollToEnd({ animated: true });
    } else {
      setShowJumpToLatest(true);
    }
  }, []);

  const jumpToLatest = useCallback(() => {
    shouldAutoScroll.current = true;
    setShowJumpToLatest(false);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const emptyContent = useMemo(
    () => (
      <View style={styles.messagePair}>
        <Text
          style={[
            styles.transcriptText,
            {
              color: theme.primary,
              fontSize,
              lineHeight: fontSize * 1.45,
            },
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
              lineHeight: fontSize * 1.3,
            },
          ]}
        >
          {translatedText}
        </Text>
      </View>
    ),
    [fontSize, theme, transcriptText, translatedText],
  );

  return (
    <View style={styles.liveArea}>
      <FlatList
        ref={listRef}
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          history.length === 0 && !liveItem ? emptyContent : null
        }
        ListFooterComponent={liveFooter}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        extraData={copiedItem}
        keyboardShouldPersistTaps="handled"
      />
      {showJumpToLatest && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jump to latest transcript"
          onPress={jumpToLatest}
          style={[
            styles.jumpButton,
            { backgroundColor: theme.panelAlt, borderColor: theme.secondary },
          ]}
        >
          <Text style={[styles.jumpText, { color: theme.primary }]}>
            ↓ Latest
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  liveArea: {
    flex: 1,
    paddingTop: 8,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 76,
  },
  messagePair: {
    gap: 8,
    marginBottom: 26,
    paddingHorizontal: 2,
  },
  transcriptText: {
    fontWeight: "500",
  },
  translationText: {
    fontWeight: "500",
  },
  copiedLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  jumpButton: {
    position: "absolute",
    right: 10,
    bottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jumpText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
