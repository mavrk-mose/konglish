import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useState } from "react";
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
import type { TranslationDirection } from "@/types/translation";

function KeepAwakeWhileListening() {
  useKeepAwake();
  return null;
}

export default function HomeScreen() {
  const [direction, setDirection] = useState<TranslationDirection>("ko-to-en");
  const {
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
    direction,
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
      {speech.isListeningEnabled && <KeepAwakeWhileListening />}
      <LiveControls
        direction={direction}
        isRecording={speech.isRecording}
        isListeningEnabled={speech.isListeningEnabled}
        soundLevel={speech.soundLevel}
        onDirectionChange={setDirection}
        onToggleListening={() => void speech.toggleListening()}
        onExport={() =>
          void exportSessionLog(
            direction === "ko-to-en"
              ? speech.sourceText
              : speech.translationText,
            direction === "ko-to-en"
              ? speech.translationText
              : speech.sourceText,
            speech.isRecording,
          )
        }
      />
      <LiveTranscript
        sourceText={speech.sourceText}
        translationText={speech.translationText}
        sourceLanguage={direction === "ko-to-en" ? "Korean" : "English"}
        targetLanguage={direction === "ko-to-en" ? "English" : "Korean"}
        entries={entries}
        onEditEntry={startEditingEntry}
        onDeleteEntry={confirmDeleteEntry}
      />
      <TranscriptEditorModal
        visible={editingEntryId !== null}
        koreanText={editKoreanText}
        englishText={editEnglishText}
        isSaving={isSavingEdit}
        onChangeKoreanText={setEditKoreanText}
        onChangeEnglishText={setEditEnglishText}
        onClose={() => setEditingEntryId(null)}
        onSave={() => void saveEditedEntry(direction)}
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
