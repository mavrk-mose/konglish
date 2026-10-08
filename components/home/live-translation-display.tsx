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
  translationId?: string;
  onTranslationFocusHandled: () => void;
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

const LIVE_CURRENT_ID = "live-current";
const SCROLL_TO_LATEST_THRESHOLD = 48;
const COPY_CONFIRMATION_DURATION = 1500;
const MAINTAIN_VISIBLE_CONTENT_POSITION = {
  minIndexForVisible: 0,
  autoscrollToTopThreshold: SCROLL_TO_LATEST_THRESHOLD,
};

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
          accessibilityHint={
            canCopy
              ? "Copies this translation to the clipboard"
              : "Copying is unavailable right now"
          }
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
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[
              styles.copiedLabel,
              { color: theme.secondary, opacity: isCopied ? 1 : 0 },
            ]}
          >
            Copied
          </Text>
        </Pressable>
      )}
    </View>
  );
});

function useLiveTranslationHistory(finalizedSegments: TranslationItem[]) {
  const [history, setHistory] = useState(() => loadLiveHistory().reverse());
  const processedIds = useRef(new Set(history.map((item) => item.id)));

  useEffect(() => {
    const processed = processedIds.current;
    if (processed === null) return;

    const seenIds = new Set(processed);
    const newSegments = finalizedSegments.filter((segment) => {
      if (
        segment.id === LIVE_CURRENT_ID ||
        seenIds.has(segment.id) ||
        segment.transcript.trim().length === 0
      ) {
        return false;
      }

      seenIds.add(segment.id);
      return true;
    });

    if (newSegments.length === 0) return;

    try {
      const appendedItems = appendLiveHistory(newSegments);
      for (const segment of newSegments) {
        processed.add(segment.id);
      }
      if (appendedItems.length > 0) {
        setHistory((current) => [
          ...appendedItems.slice().reverse(),
          ...current,
        ]);
      }
    } catch (error) {
      console.error("Could not save live translation history:", error);
    }
  }, [finalizedSegments]);

  return history;
}

export function LiveTranslationDisplay({
  theme,
  fontSize,
  transcriptText,
  translatedText,
  canCopyTranslation,
  hasLiveTranscript,
  finalizedSegments,
  translationId,
  onTranslationFocusHandled,
  onOpenSearch,
}: LiveTranslationDisplayProps) {
  const history = useLiveTranslationHistory(finalizedSegments);
  const [copiedItem, setCopiedItem] = useState<{
    id: string;
    translation: string;
  } | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const listRef = useRef<FlatList<TranslationItem>>(null);
  const showJumpToLatestRef = useRef(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequestId = useRef(0);
  const scrollRetryCount = useRef(0);
  const pendingScrollIndex = useRef<number | null>(null);
  const scrollRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!translationId) return;

    const index = history.findIndex((item) => item.id === translationId);
    if (index < 0) return;

    if (scrollRetryTimeout.current) {
      clearTimeout(scrollRetryTimeout.current);
      scrollRetryTimeout.current = null;
    }
    pendingScrollIndex.current = index;
    scrollRetryCount.current = 0;
    listRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
    onTranslationFocusHandled();
  }, [history, onTranslationFocusHandled, translationId]);

  useEffect(
    () => () => {
      copyRequestId.current += 1;
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      if (scrollRetryTimeout.current) clearTimeout(scrollRetryTimeout.current);
    },
    [],
  );

  const copyTranslation = useCallback(async (item: TranslationItem) => {
    if (!item.translation.trim()) return;

    const requestId = ++copyRequestId.current;

    try {
      await Clipboard.setStringAsync(item.translation);
      if (copyRequestId.current !== requestId) return;

      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      setCopiedItem((current) =>
        current?.id === item.id &&
        current.translation === item.translation
          ? current
          : { id: item.id, translation: item.translation },
      );
      const timeout = setTimeout(() => {
        if (copyTimeout.current !== timeout) return;
        setCopiedItem((current) =>
          current?.id === item.id && current.translation === item.translation
            ? null
            : current,
        );
        copyTimeout.current = null;
      }, COPY_CONFIRMATION_DURATION);
      copyTimeout.current = timeout;
    } catch (error) {
      if (copyRequestId.current !== requestId) return;
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
        canCopy={Boolean(item.translation.trim())}
        isCopied={
          copiedItem?.id === item.id &&
          copiedItem.translation === item.translation
        }
        onCopy={copyTranslation}
      />
    ),
    [copiedItem, copyTranslation, fontSize, theme],
  );

  const liveItem = useMemo<TranslationItem | null>(() => {
    if (!hasLiveTranscript || transcriptText.trim().length === 0) return null;

    const latestCompleted = history[0];
    if (
      latestCompleted?.transcript === transcriptText &&
      latestCompleted.translation === translatedText
    ) {
      return null;
    }

    return {
      id: LIVE_CURRENT_ID,
      transcript: transcriptText,
      translation: translatedText,
    };
  }, [hasLiveTranscript, history, transcriptText, translatedText]);

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
      const shouldShowJumpButton =
        event.nativeEvent.contentOffset.y > SCROLL_TO_LATEST_THRESHOLD;
      if (showJumpToLatestRef.current === shouldShowJumpButton) return;
      showJumpToLatestRef.current = shouldShowJumpButton;
      setShowJumpToLatest(shouldShowJumpButton);
    },
    [],
  );

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      if (
        pendingScrollIndex.current !== info.index ||
        scrollRetryCount.current >= 2
      ) {
        return;
      }

      scrollRetryCount.current += 1;
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      scrollRetryTimeout.current = setTimeout(() => {
        scrollRetryTimeout.current = null;
        if (pendingScrollIndex.current !== info.index) return;
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.5,
        });
      }, 100);
    },
    [],
  );

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
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={liveHeader}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          // Stay pinned to the latest entry if you're at the bottom, but
          // don't yank you down while you're reading older entries.
          maintainVisibleContentPosition={MAINTAIN_VISIBLE_CONTENT_POSITION}
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
