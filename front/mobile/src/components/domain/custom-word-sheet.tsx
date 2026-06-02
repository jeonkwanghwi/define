/**
 * CustomWordSheet — 사용자가 직접 단어를 추가하는 바텀시트.
 *
 * design-source의 CustomWordSheet를 RN으로 포팅 + UX 보완:
 *   - 슬라이드업 후 250ms 딜레이로 autoFocus (동시에 띄우면 키보드 등장이 끊김)
 *   - 키보드 가림 방지 (KeyboardAvoidingView)
 *   - 글자 수 카운터 (최대 12자)
 *   - Enter 키로 submit (returnKeyType="done")
 *   - 닫힘 시 입력 초기화 → 다음 열기는 빈 상태로
 *
 * 사용:
 *   <CustomWordSheet visible={open} onAdd={addCustomWord} onClose={...} />
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
import { useTheme } from '@/theme';

const MAX_LENGTH = 12;

export type CustomWordSheetProps = {
  visible: boolean;
  onAdd: (word: string) => void;
  onClose: () => void;
};

export function CustomWordSheet({ visible, onAdd, onClose }: CustomWordSheetProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  useEffect(() => {
    if (visible) {
      // 시트 슬라이드업이 끝난 직후 포커스. 동시 처리하면 키보드 등장이 끊기는 느낌이 남.
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    } else {
      // 닫힐 때 입력 리셋
      setValue('');
    }
  }, [visible]);

  function handleSubmit() {
    if (!canSubmit) return;
    onAdd(trimmed);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 외부 탭 → 닫기. 내부 탭은 stopPropagation 효과를 위해 별도 Pressable. */}
      <Pressable
        style={[styles.scrim, { backgroundColor: 'rgba(20,18,15,0.42)' }]}
        onPress={onClose}
      >
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
            <View
              style={[styles.grip, { backgroundColor: theme.colors.line.strong }]}
            />
            <ThemedText
              variant="h3"
              style={{ marginBottom: theme.spacing.s4 }}
            >
              어떤 단어를 정의할까요?
            </ThemedText>

            <TextField
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              placeholder="예: 자유, 외로움, 엄마…"
              maxLength={MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <View style={[styles.counterRow, { marginTop: theme.spacing.s2 }]}>
              <ThemedText variant="caption" tone="placeholder">
                {value.length}/{MAX_LENGTH}자
              </ThemedText>
            </View>

            <Button
              label="완료"
              fullWidth
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={{ marginTop: theme.spacing.s4 }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

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
  counterRow: { alignItems: 'flex-end' },
});
