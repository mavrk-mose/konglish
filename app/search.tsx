import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ArrowLeft, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppTheme } from "@/constants/theme";
import { searchLiveHistory } from "@/lib/live-translation-history";
import type { TranslationItem } from "@/types/live-translation";

const THEME_STORAGE_KEY = "konglish.theme-mode";

function getSearchableText(item: TranslationItem, query: string): string {
  const transcript = item.transcript.replace(/\s+/gu, " ").trim();
  const translation = item.translation.replace(/\s+/gu, " ").trim();

  if (!query) return transcript || translation;

  const normalizedQuery = query.toLocaleLowerCase();
  if (transcript.toLocaleLowerCase().includes(normalizedQuery)) {
    return transcript;
  }

  return translation;
}

function getTimestamp(item: TranslationItem): string {
  const createdAt =
    item.createdAt ?? Number.parseInt(item.id.split("-")[0], 10);
  if (!Number.isFinite(createdAt)) return "";

  return new Date(createdAt).toLocaleString();
}

function SearchResult({
  item,
  query,
  theme,
}: {
  item: TranslationItem;
  query: string;
  theme: (typeof AppTheme)[keyof typeof AppTheme];
}) {
  const text = getSearchableText(item, query);
  const normalizedText = text.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedQuery);
  const start = Math.max(0, matchIndex - 48);
  const end = Math.min(text.length, matchIndex + normalizedQuery.length + 72);
  const visibleText = text.slice(start, end);
  const visibleMatchStart = matchIndex >= 0 ? matchIndex - start : -1;
  const beforeMatch =
    visibleMatchStart >= 0
      ? visibleText.slice(0, visibleMatchStart)
      : visibleText;
  const match =
    visibleMatchStart >= 0
      ? visibleText.slice(
          visibleMatchStart,
          visibleMatchStart + normalizedQuery.length,
        )
      : "";
  const afterMatch =
    visibleMatchStart >= 0
      ? visibleText.slice(visibleMatchStart + normalizedQuery.length)
      : "";

  return (
    <View style={[styles.result, { borderBottomColor: theme.border }]}>
      <Text
        numberOfLines={2}
        style={[styles.resultText, { color: theme.primary }]}
      >
        {start > 0 ? "… " : ""}
        {beforeMatch}
        {match ? (
          <Text style={styles.highlightedMatch}>{match}</Text>
        ) : null}
        {afterMatch}
        {end < text.length ? " …" : ""}
      </Text>
      <Text style={[styles.timestamp, { color: theme.muted }]}>
        {getTimestamp(item)}
      </Text>
    </View>
  );
}

export default function SearchScreen() {
  const systemTheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    systemTheme === "dark" ? "dark" : "light",
  );
  const [query, setQuery] = useState("");
  const theme = AppTheme[themeMode];

  const { results, searchFailed } = useMemo(() => {
    try {
      return {
        results: searchLiveHistory(query),
        searchFailed: false,
      };
    } catch (error) {
      console.error("Could not search saved translations:", error);
      return {
        results: [] as TranslationItem[],
        searchFailed: true,
      };
    }
  }, [query]);

  useEffect(() => {
    let isMounted = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedTheme) => {
        if (
          isMounted &&
          (storedTheme === "light" || storedTheme === "dark")
        ) {
          setThemeMode(storedTheme);
        }
      })
      .catch((error) => {
        console.warn("Could not load search screen theme:", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TranslationItem }) => (
      <SearchResult item={item} query={query.trim()} theme={theme} />
    ),
    [query, theme],
  );

  const emptyContent = useMemo(() => {
    let message = "Search completed translations";
    if (searchFailed) message = "Search is unavailable. Please try again.";
    else if (query.trim()) message = "No matching translations";

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: theme.secondary }]}>
          {message}
        </Text>
      </View>
    );
  }, [query, searchFailed, theme]);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={closeSearch}
          style={styles.backButton}
        >
          <ArrowLeft color={theme.primary} size={24} strokeWidth={2} />
        </Pressable>
        <View
          style={[
            styles.searchField,
            { backgroundColor: theme.panelAlt, borderColor: theme.border },
          ]}
        >
          <Search color={theme.muted} size={19} strokeWidth={2} />
          <TextInput
            accessibilityLabel="Search translations"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            clearButtonMode="never"
            onChangeText={setQuery}
            onSubmitEditing={Keyboard.dismiss}
            placeholder="Search translations"
            placeholderTextColor={theme.muted}
            returnKeyType="search"
            style={[styles.input, { color: theme.primary }]}
            value={query}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              hitSlop={8}
              style={styles.clearButton}
            >
              <X color={theme.muted} size={19} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={[
          styles.resultsContent,
          results.length === 0 && styles.emptyResultsContent,
        ]}
        ListEmptyComponent={emptyContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 36,
  },
  searchField: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    minHeight: 42,
    paddingVertical: 8,
  },
  clearButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  resultsContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyResultsContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  result: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 18,
  },
  resultText: {
    fontSize: 17,
    lineHeight: 25,
  },
  highlightedMatch: {
    backgroundColor: "#FFC400",
    color: "#111111",
  },
  timestamp: {
    fontSize: 13,
  },
});
