import { createMMKV } from "react-native-mmkv";

import type { TranslationItem } from "@/types/live-translation";

const HISTORY_STORAGE_KEY = "konglish.live-translation-history";
const MIGRATED_STORAGE_KEY = "konglish.live-translation-history-migrated";
const INDEX_REMOVED_STORAGE_KEY = "konglish.live-translation-index-removed";
const ITEM_KEY_PREFIX = "item:";
const LEGACY_INDEX_KEY_PREFIX = "index:";
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
  return value.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function getItemKey(id: string): string {
  return `${ITEM_KEY_PREFIX}${encodeURIComponent(id)}`;
}

function parseIdTime(id: string): number {
  const timestamp = Number.parseInt(id.split("-")[0], 10);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getItemTime(item: TranslationItem): number {
  return item.createdAt ?? parseIdTime(item.id);
}

function persistItem(item: TranslationItem): void {
  // JSON.stringify turns NaN into null, which readItem would reject.
  const safeItem =
    item.createdAt !== undefined && !Number.isFinite(item.createdAt)
      ? { ...item, createdAt: undefined }
      : item;

  historyStorage.set(getItemKey(item.id), JSON.stringify(safeItem));
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

function getAllItems(): TranslationItem[] {
  return historyStorage
    .getAllKeys()
    .filter((key) => key.startsWith(ITEM_KEY_PREFIX))
    .map((key) =>
      readItem(decodeURIComponent(key.slice(ITEM_KEY_PREFIX.length))),
    )
    .filter((item): item is TranslationItem => item !== null);
}

function migrateLegacyHistory(): void {
  if (!historyStorage.getBoolean(MIGRATED_STORAGE_KEY)) {
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

  // One-time cleanup of the old n-gram index keys.
  if (!historyStorage.getBoolean(INDEX_REMOVED_STORAGE_KEY)) {
    for (const key of historyStorage.getAllKeys()) {
      if (key.startsWith(LEGACY_INDEX_KEY_PREFIX)) historyStorage.remove(key);
    }
    historyStorage.set(INDEX_REMOVED_STORAGE_KEY, true);
  }
}

export function loadLiveHistory(): TranslationItem[] {
  migrateLegacyHistory();

  // Oldest -> newest
  return getAllItems().sort((a, b) => getItemTime(a) - getItemTime(b));
}

export function appendLiveHistory(
  items: TranslationItem[],
): TranslationItem[] {
  migrateLegacyHistory();

  const newItems = items.filter(
    (item) => !historyStorage.contains(getItemKey(item.id)),
  );
  for (const item of newItems) persistItem(item);

  return newItems;
}

export function searchLiveHistory(query: string): TranslationItem[] {
  migrateLegacyHistory();

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  // Newest first
  return getAllItems()
    .filter(
      (item) =>
        normalizeText(item.transcript).includes(normalizedQuery) ||
        normalizeText(item.translation).includes(normalizedQuery),
    )
    .sort((a, b) => getItemTime(b) - getItemTime(a));
}

export function clearLiveHistory(): void {
  historyStorage.clearAll();
}