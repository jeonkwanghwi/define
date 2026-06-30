/**
 * RedefineSheet — 질문모드에서 그 단어를 "지금 다시 정의"하는 입력 시트.
 * CustomWordSheet의 Modal 패턴. 저장 시 onSave(text) → caller가 addEntry로 새 엔트리 기록.
 */
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

export type RedefineSheetProps = {
  visible: boolean;
  word: string;
  onSave: (text: string) => void;
  onClose: () => void;
};

export function RedefineSheet({ visible, word, onSave, onClose }: RedefineSheetProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const save = () => {
    const v = text.trim();
    if (!v) return;
    onSave(v);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.scrimInner}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.colors.paper.base, borderColor: theme.colors.line.base }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText variant="h3">'{word}', 지금 다시 정의</ThemedText>
            <ThemedText variant="caption" tone="placeholder" style={{ marginTop: 4 }}>
              지금의 생각으로 이 단어를 새로 적어요. 기록으로 남아요.
            </ThemedText>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={`${word}이란…`}
              placeholderTextColor={theme.colors.ink.placeholder}
              multiline
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base, color: theme.colors.ink.primary },
              ]}
            />
            <Button label="기록하기" onPress={save} style={{ alignSelf: 'stretch' }} />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  scrimInner: { width: '100%' },
  sheet: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1 },
  input: { marginTop: 16, minHeight: 96, maxHeight: 160, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16, textAlignVertical: 'top' },
});
