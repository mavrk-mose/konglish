import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { createMMKV } from "react-native-mmkv";

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { TranscriptEntry } from "@/types/transcript";

const TRANSCRIPT_STORAGE_KEY = "konglish.completed-translations";
const transcriptStorage = createMMKV({ id: "konglish-transcripts" });

const loadSavedTranscript = (): TranscriptEntry[] => {
  try {
    const savedTranscript = transcriptStorage.getString(TRANSCRIPT_STORAGE_KEY);
    if (!savedTranscript) return [];

    const parsedTranscript: unknown = JSON.parse(savedTranscript);
    if (!Array.isArray(parsedTranscript)) return [];

    return parsedTranscript.filter(
      (entry): entry is TranscriptEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.id === "string" &&
        typeof entry.sequence === "number" &&
        typeof entry.ko === "string" &&
        typeof entry.en === "string" &&
        typeof entry.timestamp === "string",
    );
  } catch (error) {
    console.warn("Could not load saved translations:", error);
    return [];
  }
};

export function useTranscript() {
  const [entries, setEntries] =
    useState<TranscriptEntry[]>(loadSavedTranscript);
  const entriesRef = useRef(entries);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editKoreanText, setEditKoreanText] = useState("");
  const [editEnglishText, setEditEnglishText] = useState("");

  const updateSavedTranscript = useCallback(
    (update: (currentEntries: TranscriptEntry[]) => TranscriptEntry[]) => {
      const updatedEntries = update(entriesRef.current);
      entriesRef.current = updatedEntries;
      transcriptStorage.set(
        TRANSCRIPT_STORAGE_KEY,
        JSON.stringify(updatedEntries),
      );
      setEntries(updatedEntries);
    },
    [],
  );

  const startEditingEntry = (entry: TranscriptEntry) => {
    setEditingEntryId(entry.id);
    setEditKoreanText(entry.ko);
    setEditEnglishText(entry.en);
  };

  const saveEditedEntry = () => {
    const korean = editKoreanText.trim();
    const english = editEnglishText.trim();
    if (!korean || !english || !editingEntryId) {
      Alert.alert("Text required", "Enter both the Korean and English text.");
      return;
    }

    updateSavedTranscript((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === editingEntryId
          ? { ...entry, ko: korean, en: english }
          : entry,
      ),
    );
    setEditingEntryId(null);
  };

  const confirmDeleteEntry = (entry: TranscriptEntry) => {
    Alert.alert("Delete completed translation?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          updateSavedTranscript((currentEntries) =>
            currentEntries.filter((savedEntry) => savedEntry.id !== entry.id),
          ),
      },
    ]);
  };

  const exportSessionLog = async (
    koreanText: string,
    englishText: string,
    isRecording: boolean,
  ) => {
    if (entries.length === 0 && !koreanText) {
      Alert.alert("Empty session", "There is no transcript to export yet.");
      return;
    }

    const completedEntries = entries
      .map(
        (entry, index) =>
          `[Sentence ${index + 1} - ${entry.timestamp}]\nKR: ${entry.ko}\nEN: ${entry.en}`,
      )
      .join("\n\n");
    const currentEntry = koreanText
      ? `[Current stream${isRecording ? " - Live" : ""}]\nKR: ${koreanText}\nEN: ${englishText || "Translation pending"}`
      : "";
    const content = [
      "--- TRANSLATION SESSION LOG ---",
      completedEntries,
      currentEntry,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const file = new File(Paths.document, `Transcript_${Date.now()}.txt`);
      file.create({ overwrite: true });
      file.write(content, { encoding: "utf8" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: "Export translation transcript",
          mimeType: "text/plain",
          UTI: "public.plain-text",
        });
      } else {
        Alert.alert("Export complete", `Transcript saved at ${file.uri}`);
      }
    } catch (error) {
      console.error("Transcript export failed:", error);
      Alert.alert("Export failed", "The transcript file could not be created.");
    }
  };

  return {
    entries,
    updateSavedTranscript,
    editingEntryId,
    setEditingEntryId,
    editKoreanText,
    setEditKoreanText,
    editEnglishText,
    setEditEnglishText,
    startEditingEntry,
    saveEditedEntry,
    confirmDeleteEntry,
    exportSessionLog,
  };
}
