/**
 * BugReportSheet — 버그 제보를 적어 보내는 바텀시트.
 *
 * NicknameSheet와 같은 뼈대: Modal + KeyboardAvoidingView + TextField + Button.
 * 받는 건 제목과 내용 둘뿐이다 — 기기·앱 버전은 호출부가 자동으로 붙인다(사용자가 적을 일이 아니다).
 *
 * 비동기 3종:
 *   - 진행 중: 버튼 loading(눌림 자체가 막힌다) + sending 가드로 중복 전송 차단
 *   - 실패: 시트 안 인라인 문구. **시트를 먼저 닫지 않는다** — 닫으면 실패를 보여줄 자리가
 *     사라지고 사용자가 쓴 내용도 날아간다(2026-10-04 회상 동의에서 똑같은 실수를 했다)
 *   - 성공: 호출부가 시트를 닫고 토스트를 띄운다
 *
 * 사용:
 *   <BugReportSheet visible={open} onSubmit={send} onClose={...} />
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

const TITLE_MAX = 100;
const BODY_MAX = 2000;

export type BugReportSheetProps = {
  visible: boolean;
  onSubmit: (input: { title: string; body: string }) => Promise<void>;
  onClose: () => void;
};

export function BugReportSheet({ visible, onSubmit, onClose }: BugReportSheetProps) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // 닫았다 다시 열면 빈 종이로 — 보낸 제보가 남아 있으면 또 보낸 줄 알게 된다.
      setTitle('');
      setBody('');
      setError(null);
      const t = setTimeout(() => titleRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  async function handleSubmit() {
    if (sending || !canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), body: body.trim() });
      // 닫기는 성공한 뒤에만. 실패했을 땐 이 시트가 에러를 그리는 유일한 자리다.
      onClose();
    } catch (e) {
      setError(mapFeedbackError(e));
    } finally {
      setSending(false);
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
              버그 제보
            </ThemedText>
            <ThemedText
              variant="caption"
              tone="placeholder"
              style={{ marginBottom: theme.spacing.s4 }}
            >
              어떤 일이 있었는지 알려주시면 고치는 데 큰 도움이 돼요.
            </ThemedText>

            <TextField
              ref={titleRef}
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                setError(null);
              }}
              placeholder="예: 광장에서 하트가 눌리지 않아요"
              maxLength={TITLE_MAX}
              returnKeyType="next"
            />

            <TextField
              multiline
              value={body}
              onChangeText={(t) => {
                setBody(t);
                setError(null);
              }}
              placeholder="어떤 화면에서, 무엇을 했을 때 그랬는지 적어주세요."
              maxLength={BODY_MAX}
              style={{ minHeight: 140, marginTop: theme.spacing.s3 }}
              // 에러는 두 입력 중 아래쪽에만 그린다 — 두 번 그리면 뭐가 문제인지 흐려진다.
              error={error ?? undefined}
            />

            <View style={[styles.counterRow, { marginTop: theme.spacing.s2 }]}>
              <ThemedText variant="caption" tone="placeholder">
                {body.length}/{BODY_MAX}자
              </ThemedText>
            </View>

            <Button
              label="보내기"
              loading={sending}
              disabled={!canSend}
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

/**
 * 서버/네트워크 에러 → 인라인 문구.
 * 서버 메시지(쿨다운 429 등)는 이미 우리 톤의 한국어라 그대로 쓴다 —
 * 여기서 다시 적으면 같은 문구가 두 군데에 생긴다.
 */
function mapFeedbackError(e: unknown): string {
  const err = e as Partial<ApiError>;
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
