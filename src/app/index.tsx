import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LiveControls } from "@/components/live-controls";
import { LiveTranscript } from "@/components/live-transcript";
import { OfflineSetup } from "@/components/offline-setup";
import { SpeechStatusFooter } from "@/components/speech-status-footer";
import { TranscriptEditorModal } from "@/components/transcript-editor-modal";
import { useSpeechTranslation } from "@/hooks/use-speech-translation";
import { useTranscript } from "@/hooks/use-transcript";
import { useTranslationModels } from "@/hooks/use-translation-models";
import type { TranscriptEntry } from "@/types/transcript";

export default function HomeScreen() {
  const {
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
  } = useTranscript();
  const {
    isReady,
    progressMessage,
    error: modelError,
    retry,
  } = useTranslationModels();
  const initialSequence = entries.reduce(
    (highest, entry) => Math.max(highest, entry.sequence),
    0,
  );
  const appendTranscriptEntry = useCallback(
    (entry: TranscriptEntry) => {
      updateSavedTranscript((currentEntries) =>
        [...currentEntries, entry].sort(
          (first, second) => first.sequence - second.sequence,
        ),
      );
    },
    [updateSavedTranscript],
  );
  const speech = useSpeechTranslation({
    enabled: isReady,
    initialSequence,
    onTranscriptComplete: appendTranscriptEntry,
  });

  if (!isReady) {
    return (
      <OfflineSetup
        error={modelError}
        progressMessage={progressMessage}
        onRetry={retry}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LiveControls
        isRecording={speech.isRecording}
        isListeningEnabled={speech.isListeningEnabled}
        soundLevel={speech.soundLevel}
        onToggleListening={() => void speech.toggleListening()}
        onExport={() =>
          void exportSessionLog(
            speech.koreanText,
            speech.englishText,
            speech.isRecording,
          )
        }
      />
      <LiveTranscript
        koreanText={speech.koreanText}
        englishText={speech.englishText}
        entries={entries}
        onEditEntry={startEditingEntry}
        onDeleteEntry={confirmDeleteEntry}
      />
      <TranscriptEditorModal
        visible={editingEntryId !== null}
        koreanText={editKoreanText}
        englishText={editEnglishText}
        onChangeKoreanText={setEditKoreanText}
        onChangeEnglishText={setEditEnglishText}
        onClose={() => setEditingEntryId(null)}
        onSave={saveEditedEntry}
      />
      <SpeechStatusFooter
        isRecording={speech.isRecording}
        status={speech.status}
        error={speech.error}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F5F0",
    paddingHorizontal: 24,
    paddingTop: 28,
  },
});
