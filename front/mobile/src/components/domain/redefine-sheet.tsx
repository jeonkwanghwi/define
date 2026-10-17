/**
 * RedefineSheet — 질문모드에서 그 단어를 "지금 다시 정의"하는 입력 시트.
 * CustomWordSheet와 같은 껍데기(그립·surface 바탕·radii.xl·TextField)를 쓴다 —
 * 같은 "아래에서 올라오는 입력 시트"가 화면마다 다르게 생기면 다른 물건처럼 느껴진다.
 * 저장 시 onSave(text) → caller가 addEntry로 새 엔트리 기록.
 */
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';

import { Button, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { MIN_DEFINITION_LENGTH } from '@/lib/definition';
import { topicSuffix } from '@/lib/korean';
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
      // 시트 슬라이드업이 끝난 직후 포커스 (CustomWordSheet와 같은 이유).
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const canSave = text.trim().length >= MIN_DEFINITION_LENGTH;

  const save = () => {
    const v = text.trim();
    if (v.length < MIN_DEFINITION_LENGTH) return;
    onSave(v);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.scrim, { backgroundColor: theme.colors.scrim }]} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kbWrap}
        >
          <Pressable
            onPress={() => {
              /* 시트 내부 탭이 부모(scrim)로 전파되어 닫히지 않게 차단 */
            }}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface.base,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
              },
            ]}
          >
            <View style={[styles.grip, { backgroundColor: theme.colors.line.strong }]} />
            <ThemedText variant="h3">'{word}', 지금 다시 정의</ThemedText>
            <ThemedText
              variant="caption"
              tone="placeholder"
              style={{ marginTop: theme.spacing.s1, marginBottom: theme.spacing.s4 }}
            >
              지금의 생각으로 이 단어를 새로 적어요. 기록으로 남아요.
            </ThemedText>

            <TextField
              ref={inputRef}
              multiline
              value={text}
              onChangeText={setText}
              placeholder={`${word}${topicSuffix(word)}…`}
              style={styles.input}
            />

            {/* 최소 글자 수 미만이면 버튼이 왜 안 눌리는지 카운터로 목표를 보여줌 */}
            <View style={[styles.counterRow, { marginTop: theme.spacing.s2 }]}>
              <ThemedText
                variant="caption"
                style={{ color: canSave ? theme.colors.ink.placeholder : theme.colors.point.p600 }}
              >
                {canSave ? `${text.length}자` : `${text.trim().length}/${MIN_DEFINITION_LENGTH}자`}
              </ThemedText>
            </View>

            <Button
              label="기록하기"
              fullWidth
              disabled={!canSave}
              onPress={save}
              style={{ marginTop: theme.spacing.s4 }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// 껍데기 치수는 CustomWordSheet와 같다.
const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  kbWrap: { width: '100%' },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  input: { minHeight: 96, maxHeight: 160 },
  counterRow: { alignItems: 'flex-end' },
});
