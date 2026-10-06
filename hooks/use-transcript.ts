import { useCallback, useRef, useState } from "react";
import { createMMKV } from "react-native-mmkv";

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

  return { entries, updateSavedTranscript };
}
