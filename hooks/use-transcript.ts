import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { createMMKV } from "react-native-mmkv";

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { TranscriptEntry } from "@/types/transcript";
import type { TranslationDirection } from "@/types/translation";

import TranslateText, {
  TranslateLanguage,
} from "@react-native-ml-kit/translate-text";

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
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const saveEditedEntry = async (direction: TranslationDirection) => {
    const korean = editKoreanText.trim();
    const english = editEnglishText.trim();
    if (!korean || !english || !editingEntryId) {
      Alert.alert("Text required", "Enter both the Korean and English text.");
      return;
    }

    const entryToEdit = entriesRef.current.find(
      (entry) => entry.id === editingEntryId,
    );
    if (!entryToEdit) {
      Alert.alert(
        "Edit unavailable",
        "This completed sentence could not be found.",
      );
      setEditingEntryId(null);
      return;
    }

    const koreanChanged = korean !== entryToEdit.ko;
    const englishChanged = english !== entryToEdit.en;
    if (!koreanChanged && !englishChanged) {
      setEditingEntryId(null);
      return;
    }

    const translationDirection: TranslationDirection =
      koreanChanged && !englishChanged
        ? "ko-to-en"
        : englishChanged && !koreanChanged
          ? "en-to-ko"
          : direction;
    const sourceText = translationDirection === "ko-to-en" ? korean : english;

    setIsSavingEdit(true);
    try {
      const translatedText = (await TranslateText.translate({
        text: sourceText.replace(/\s+/gu, " "),
        sourceLanguage:
          translationDirection === "ko-to-en"
            ? TranslateLanguage.KOREAN
            : TranslateLanguage.ENGLISH,
        targetLanguage:
          translationDirection === "ko-to-en"
            ? TranslateLanguage.ENGLISH
            : TranslateLanguage.KOREAN,
        downloadModelIfNeeded: false,
      })) as string;

      updateSavedTranscript((currentEntries) =>
        currentEntries.map((entry) =>
          entry.id === editingEntryId
            ? translationDirection === "ko-to-en"
              ? { ...entry, ko: korean, en: translatedText }
              : { ...entry, ko: translatedText, en: english }
            : entry,
        ),
      );
      setEditingEntryId(null);
    } catch (error) {
      console.error("Edited sentence translation failed:", error);
      Alert.alert(
        "Translation failed",
        "The edited sentence could not be translated. Please try again.",
      );
    } finally {
      setIsSavingEdit(false);
    }
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
    isSavingEdit,
    startEditingEntry,
    saveEditedEntry,
    confirmDeleteEntry,
    exportSessionLog,
  };
}
