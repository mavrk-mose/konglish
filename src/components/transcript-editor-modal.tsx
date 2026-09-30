import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type TranscriptEditorModalProps = {
  visible: boolean;
  koreanText: string;
  englishText: string;
  onChangeKoreanText: (text: string) => void;
  onChangeEnglishText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function TranscriptEditorModal({
  visible,
  koreanText,
  englishText,
  onChangeKoreanText,
  onChangeEnglishText,
  onClose,
  onSave,
}: TranscriptEditorModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit completed text</Text>
          <Text style={styles.label}>Korean</Text>
          <TextInput
            multiline
            value={koreanText}
            onChangeText={onChangeKoreanText}
            placeholder="Korean source text"
            placeholderTextColor="#87938D"
            style={styles.input}
          />
          <Text style={styles.label}>English</Text>
          <TextInput
            multiline
            value={englishText}
            onChangeText={onChangeEnglishText}
            placeholder="English translation"
            placeholderTextColor="#87938D"
            style={styles.input}
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onSave}
              style={styles.saveButton}
            >
              <Text style={styles.saveText}>Save changes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 22, 0.48)",
    justifyContent: "center",
    padding: 22,
  },
  sheet: {
    backgroundColor: "#F3F5F0",
    borderRadius: 8,
    padding: 20,
  },
  title: {
    color: "#15241E",
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 18,
  },
  label: {
    color: "#718078",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE5DE",
    borderRadius: 6,
    borderWidth: 1,
    color: "#15241E",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
    minHeight: 72,
    padding: 11,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: "#53645D",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#186B52",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 15,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
