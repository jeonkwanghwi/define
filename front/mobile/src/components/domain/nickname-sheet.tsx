/**
 * NicknameSheet — 닉네임을 정하거나 바꾸는 바텀시트.
 *
 * CustomWordSheet와 동일한 UX 규약:
 *   - 슬라이드업 후 250ms 딜레이 autoFocus
 *   - 키보드 가림 방지(KeyboardAvoidingView)
 *   - 글자 수 카운터(최대 16자)
 *   - Enter(done)로 submit
 *   - 열릴 때 현재 닉네임을 미리 채워 편집 시작점으로
 *
 * 서버에 저장(중복 검사 포함)하는 비동기 동작. 저장 중엔 버튼 비활성, 실패(중복 등)는 인라인 에러로 안내.
 *
 * 사용:
 *   <NicknameSheet visible={open} current={nickname} onSave={updateNickname} onClose={...} />
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
import type { ApiError } from '@/services/api-client';
import { useTheme } from '@/theme';

const MAX_LENGTH = 16;

export type NicknameSheetProps = {
  visible: boolean;
  current: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
};

export function NicknameSheet({ visible, current, onSave, onClose }: NicknameSheetProps) {
  const theme = useTheme();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // 열릴 때 현재 값으로 초기화 후 포커스 (슬라이드업 끝난 뒤 자연스럽게 키보드)
      setValue(current);
      setError(null);
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible, current]);

  async function handleSubmit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(value.trim());
      onClose();
    } catch (e) {
      setError(mapNicknameError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kbWrap}
        >
          <Pressable
            onPress={() => {
              /* 내부 탭이 scrim으로 전파되어 닫히지 않게 차단 */
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
            <ThemedText variant="h3" style={{ marginBottom: theme.spacing.s2 }}>
              어떻게 불러드릴까요?
            </ThemedText>
            <ThemedText
              variant="caption"
              tone="placeholder"
              style={{ marginBottom: theme.spacing.s4 }}
            >
              마이페이지와 광장에서 보일 이름이에요
            </ThemedText>

            <TextField
              ref={inputRef}
              value={value}
              onChangeText={(t) => {
                setValue(t);
                setError(null);
              }}
              placeholder="예: 단어를 줍는 사람"
              maxLength={MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              error={error ?? undefined}
            />

            <View style={[styles.counterRow, { marginTop: theme.spacing.s2 }]}>
              <ThemedText variant="caption" tone="placeholder">
                {value.length}/{MAX_LENGTH}자
              </ThemedText>
            </View>

            <Button
              label="저장"
              loading={saving}
              fullWidth
              onPress={handleSubmit}
              style={{ marginTop: theme.spacing.s4 }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

/** 서버/네트워크 에러 → 우리 톤 인라인 문구. */
function mapNicknameError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.status === 409) return '이미 사용 중인 닉네임이에요. 다른 이름은 어때요?';
  if (err?.message) return err.message;
  return '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
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
