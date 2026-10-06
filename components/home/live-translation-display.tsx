import * as Clipboard from "expo-clipboard";
import { Search } from "lucide-react-native";
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

import { AppTheme } from "@/constants/theme";
import {
  appendLiveHistory,
  loadLiveHistory,
} from "@/lib/live-translation-history";
import type { TranslationItem } from "@/types/live-translation";

export type { TranslationItem } from "@/types/live-translation";

type ScreenTheme = (typeof AppTheme)[keyof typeof AppTheme];

type LiveTranslationDisplayProps = {
  theme: ScreenTheme;
  fontSize: number;
  transcriptText: string;
  translatedText: string;
  canCopyTranslation: boolean;
  hasLiveTranscript: boolean;
  finalizedSegments: TranslationItem[];
  onOpenSearch: () => void;
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
  onOpenSearch,
}: LiveTranslationDisplayProps) {
  // Stored oldest -> newest
  const [history, setHistory] = useState<TranslationItem[]>(loadLiveHistory);
  const [copiedItem, setCopiedItem] = useState<{
    id: string;
    translation: string;
  } | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const listRef = useRef<FlatList<TranslationItem>>(null);
  const processedIds = useRef(new Set<string>());
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    for (const item of history) processedIds.current.add(item.id);
  }, [history]);

  useEffect(() => {
    const newSegments = finalizedSegments.filter((segment) => {
      if (processedIds.current.has(segment.id)) return false;
      return segment.transcript.trim().length > 0;
    });

    if (newSegments.length > 0) {
      try {
        const appendedItems = appendLiveHistory(newSegments);
        for (const item of appendedItems) processedIds.current.add(item.id);
        setHistory((current) => [...current, ...appendedItems]);
      } catch (error) {
        console.error("Could not save live translation history:", error);
      }
    }
  }, [finalizedSegments]);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    [],
  );

  // Inverted list renders data[0] at the bottom, so feed it newest-first.
  const invertedHistory = useMemo(() => [...history].reverse(), [history]);

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
  }, [hasLiveTranscript, history, transcriptText, translatedText]);

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

  // In an inverted list the "header" is visually at the bottom: this is the
  // live transcript, or the "Speak ... to begin" prompt when nothing is live.
  const liveHeader = useMemo(() => {
    if (liveItem) {
      return (
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
      );
    }

    if (hasLiveTranscript) return null;

    return (
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
    );
  }, [
    canCopyTranslation,
    copiedItem,
    copyTranslation,
    fontSize,
    hasLiveTranscript,
    liveItem,
    theme,
    transcriptText,
    translatedText,
  ]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Inverted: offset 0 is the bottom (latest).
      setShowJumpToLatest(
        event.nativeEvent.contentOffset.y > BOTTOM_THRESHOLD,
      );
    },
    [],
  );

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search translations"
          onPress={onOpenSearch}
          style={[styles.iconButton, { backgroundColor: theme.panelAlt }]}
        >
          <Search color={theme.primary} size={21} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.liveArea}>
        <FlatList
          ref={listRef}
          inverted
          data={invertedHistory}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={liveHeader}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          extraData={copiedItem}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          // Stay pinned to the latest entry if you're at the bottom, but
          // don't yank you down while you're reading older entries.
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: BOTTOM_THRESHOLD,
          }}
        />
        {showJumpToLatest && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to latest transcript"
            onPress={jumpToLatest}
            style={[
              styles.jumpButton,
              {
                backgroundColor: theme.panelAlt,
                borderColor: theme.secondary,
              },
            ]}
          >
            <Text style={[styles.jumpText, { color: theme.primary }]}>
              ↓ Latest
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    alignItems: "flex-end",
    marginTop: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  liveArea: {
    flex: 1,
    paddingTop: 8,
  },
  // Inverted lists flip the container, so these paddings are swapped:
  // paddingTop = visual bottom (room for the jump button),
  // paddingBottom = visual top.
  listContent: {
    flexGrow: 1,
    paddingTop: 76,
    paddingBottom: 12,
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