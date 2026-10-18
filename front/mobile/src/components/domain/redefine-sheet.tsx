/**
 * RedefineSheet — 질문모드에서 그 단어를 "지금 다시 정의"하는 입력 시트.
 * CustomWordSheet와 같은 껍데기(그립·surface 바탕·radii.xl·TextField)를 쓴다 —
 * 같은 "아래에서 올라오는 입력 시트"가 화면마다 다르게 생기면 다른 물건처럼 느껴진다.
 * 저장 시 onSave(text) → caller가 addEntry로 새 엔트리 기록.
 * 쓰던 글이 있는데 바깥(scrim)·뒤로가기로 닫으려 하면 버릴지 먼저 묻는다.
 * 확인창은 시트 Modal **안에** 띄운다 — iOS는 한 Modal이 닫히는(애니메이션) 중에 다른 Modal을
 * 띄우면 두 번째가 안 뜬다. 시트는 열린 채로 두고 그 위에 겹치므로 그 경합이 없다.
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

import { Button, ConfirmDialog, FadeIn, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { MIN_DEFINITION_LENGTH } from '@/lib/definition';
import { topicSuffix } from '@/lib/korean';
import { ENTRY_LIMITS } from '@/lib/sync-journal';
import { controlPresets, useTheme } from '@/theme';

export type RedefineSheetProps = {
  visible: boolean;
  word: string;
  onSave: (text: string) => void;
  onClose: () => void;
};

export function RedefineSheet({ visible, word, onSave, onClose }: RedefineSheetProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setDiscardOpen(false);
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

  /** 바깥 탭·뒤로가기 — 쓴 게 있으면 묻고, 없으면 바로 닫는다. */
  const requestClose = () => {
    if (text.trim().length > 0) setDiscardOpen(true);
    else onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.scrim, { backgroundColor: theme.colors.scrim }]} onPress={requestClose}>
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
              maxLength={ENTRY_LIMITS.text} // 서버 상한 — 넘기면 동기화가 거절된다
              value={text}
              onChangeText={setText}
              placeholder={`${word}${topicSuffix(word)}…`}
              style={styles.input}
            />

            {/* 최소 글자 수 미만이면 버튼이 왜 안 눌리는지 카운터로 목표를 보여줌.
                채우면 기록 화면과 같은 체크 뱃지로 모양·색이 함께 바뀐다(같은 일은 같은 모양). */}
            <View style={[styles.counterRow, { marginTop: theme.spacing.s2 }]}>
              {canSave ? (
                // key가 바뀌면 FadeIn이 다시 마운트돼 뱃지가 스르륵 나타난다.
                <FadeIn key="ok" offset={4} style={[styles.counterOk, { backgroundColor: theme.colors.point.p100 }]}>
                  <Icon name="check" size={12} color={theme.colors.point.p700} strokeWidth={2.4} />
                  <ThemedText variant="caption" style={{ color: theme.colors.point.p700, fontWeight: '600' }}>
                    {text.length}자
                  </ThemedText>
                </FadeIn>
              ) : (
                <ThemedText key="short" variant="caption" style={{ color: theme.colors.point.p600 }}>
                  {text.trim().length}/{MIN_DEFINITION_LENGTH}자
                </ThemedText>
              )}
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

      <ConfirmDialog
        visible={discardOpen}
        title="쓰던 글을 버릴까요?"
        message="지금 닫으면 적은 내용이 사라져요."
        confirmLabel="버리기"
        cancelLabel="계속 쓰기"
        destructive
        // 대화상자 Modal이 사라지는 중에 시트 Modal을 닫으라고 하면 iOS가 무시해, 안 보이는 시트가
        // 터치를 막는다. ConfirmDialog가 onConfirm을 자기 Modal이 다 닫힌 뒤에 불러 주므로 바로 닫아도 된다.
        onConfirm={onClose}
        onClose={() => setDiscardOpen(false)}
      />
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
  // 기록 화면(tabs/index.tsx)의 counterOk와 같은 치수.
  counterOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    ...controlPresets.badge,
  },
});
