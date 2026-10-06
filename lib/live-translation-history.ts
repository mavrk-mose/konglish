import { createMMKV } from "react-native-mmkv";

import type { TranslationItem } from "@/types/live-translation";

const HISTORY_STORAGE_KEY = "konglish.live-translation-history";
const MIGRATED_STORAGE_KEY = "konglish.live-translation-history-migrated";
const ITEM_KEY_PREFIX = "item:";
const INDEX_KEY_PREFIX = "index:";
const historyStorage = createMMKV({ id: "konglish-live-history" });

function isTranslationItem(value: unknown): value is TranslationItem {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("transcript" in value) ||
    !("translation" in value)
  ) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.transcript === "string" &&
    typeof value.translation === "string" &&
    (!("createdAt" in value) ||
      value.createdAt === undefined ||
      typeof value.createdAt === "number")
  );
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
}

function getNgrams(value: string): string[] {
  const characters = Array.from(normalizeText(value));
  if (characters.length === 0) return [];
  if (characters.length === 1) return [characters[0]];

  return Array.from(
    new Set(
      characters.slice(0, -1).map((character, index) => {
        return character + characters[index + 1];
      }),
    ),
  );
}

function getItemKey(id: string): string {
  return `${ITEM_KEY_PREFIX}${encodeURIComponent(id)}`;
}

function getIndexKey(ngram: string): string {
  return `${INDEX_KEY_PREFIX}${encodeURIComponent(ngram)}`;
}

function getStoredIndex(key: string): string[] {
  const serializedIndex = historyStorage.getString(key);
  if (!serializedIndex) return [];

  try {
    const parsedIndex: unknown = JSON.parse(serializedIndex);
    return Array.isArray(parsedIndex)
      ? parsedIndex.filter((id): id is string => typeof id === "string")
      : [];
  } catch (error) {
    console.warn("Could not read live translation search index:", error);
    return [];
  }
}

function persistItem(item: TranslationItem): void {
  historyStorage.set(getItemKey(item.id), JSON.stringify(item));

  const searchableText = `${item.transcript} ${item.translation}`;
  for (const ngram of getNgrams(searchableText)) {
    const indexKey = getIndexKey(ngram);
    const indexedIds = getStoredIndex(indexKey);
    if (!indexedIds.includes(item.id)) {
      indexedIds.push(item.id);
      historyStorage.set(indexKey, JSON.stringify(indexedIds));
    }
  }
}

function migrateLegacyHistory(): void {
  if (historyStorage.getBoolean(MIGRATED_STORAGE_KEY)) return;

  const serializedHistory = historyStorage.getString(HISTORY_STORAGE_KEY);
  if (serializedHistory) {
    try {
      const parsedHistory: unknown = JSON.parse(serializedHistory);
      if (Array.isArray(parsedHistory)) {
        for (const item of parsedHistory) {
          if (isTranslationItem(item)) persistItem(item);
        }
      }
    } catch (error) {
      console.warn("Could not migrate live translation history:", error);
      return;
    }
  }

  historyStorage.remove(HISTORY_STORAGE_KEY);
  historyStorage.set(MIGRATED_STORAGE_KEY, true);
}

function readItem(id: string): TranslationItem | null {
  const serializedItem = historyStorage.getString(getItemKey(id));
  if (!serializedItem) return null;

  try {
    const parsedItem: unknown = JSON.parse(serializedItem);
    return isTranslationItem(parsedItem) ? parsedItem : null;
  } catch (error) {
    console.warn("Could not read a saved live translation:", error);
    return null;
  }
}

function sortNewestFirst(items: TranslationItem[]): TranslationItem[] {
  return items.sort((first, second) => {
    const firstTime = first.createdAt ?? parseItemTime(first.id);
    const secondTime = second.createdAt ?? parseItemTime(second.id);
    return secondTime - firstTime;
  });
}

function parseItemTime(id: string): number {
  const timestamp = Number.parseInt(id.split("-")[0], 10);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function loadLiveHistory(): TranslationItem[] {
  migrateLegacyHistory();

  return historyStorage
    .getAllKeys()
    .filter((key) => key.startsWith(ITEM_KEY_PREFIX))
    .map((key) => {
      const id = decodeURIComponent(key.slice(ITEM_KEY_PREFIX.length));
      return readItem(id);
    })
    .filter((item): item is TranslationItem => item !== null)
    .sort((first, second) => {
      const firstTime = first.createdAt ?? parseItemTime(first.id);
      const secondTime = second.createdAt ?? parseItemTime(second.id);
      return firstTime - secondTime;
    });
}

export function appendLiveHistory(
  items: TranslationItem[],
): TranslationItem[] {
  migrateLegacyHistory();

  const newItems = items.filter((item) => {
    return !historyStorage.contains(getItemKey(item.id));
  });
  for (const item of newItems) persistItem(item);

  return newItems;
}

export function searchLiveHistory(query: string): TranslationItem[] {
  migrateLegacyHistory();

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const ngrams = getNgrams(normalizedQuery);
  let candidateIds: Set<string> | null = null;

  for (const ngram of ngrams) {
    const indexedIds = new Set(getStoredIndex(getIndexKey(ngram)));
    if (candidateIds === null) {
      candidateIds = indexedIds;
    } else {
      const currentCandidates: Set<string> = candidateIds;
      candidateIds = new Set<string>(
        Array.from(currentCandidates).filter((id: string) =>
          indexedIds.has(id),
        ),
      );
    }

    if (candidateIds?.size === 0) return [];
  }

  return sortNewestFirst(
    Array.from(candidateIds ?? new Set<string>())
      .map(readItem)
      .filter((item): item is TranslationItem => item !== null)
      .filter((item) =>
        normalizeText(`${item.transcript} ${item.translation}`).includes(
          normalizedQuery,
        ),
      ),
  );
}

export function clearLiveHistory(): void {
  for (const key of historyStorage.getAllKeys()) {
    if (
      key === HISTORY_STORAGE_KEY ||
      key === MIGRATED_STORAGE_KEY ||
      key.startsWith(ITEM_KEY_PREFIX) ||
      key.startsWith(INDEX_KEY_PREFIX)
    ) {
      historyStorage.remove(key);
    }
  }
}
