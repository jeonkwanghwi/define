/**
 * RecallConsentSheet — tab3 첫 진입 AI 동의 시트(1회).
 * 무엇이 어디로 가는지는 분명히 말하되, 경고문처럼 무겁지 않게. CustomWordSheet의 Modal 패턴.
 */
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type RecallConsentSheetProps = {
  visible: boolean;
  onConsent: () => void;
  onClose: () => void;
  /** 동의 기록이 서버로 가는 중 — 버튼을 잠그고 스피너를 보여준다. */
  submitting?: boolean;
  /** 실패 사유. 조용히 닫히면 사용자는 "눌렀는데 아무 일도 없다"로 받아들인다. */
  error?: string | null;
};

export function RecallConsentSheet({
  visible,
  onConsent,
  onClose,
  submitting = false,
  error,
}: RecallConsentSheetProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: theme.colors.scrim }]} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.scrimInner}
        >
          <Pressable
            style={[
              styles.sheet,
              // 닉네임·제보 시트와 같은 겉모양(바탕·모서리·손잡이) — 시트마다 달라 보이면 다른 물건 같다.
              {
                backgroundColor: theme.colors.surface.base,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.grip, { backgroundColor: theme.colors.line.strong }]} />
            <Icon name="past" size={40} color={theme.colors.point.p600} />
            <ThemedText variant="h3" style={{ marginTop: theme.spacing.s3 }}>
              회상 시작하기
            </ThemedText>
            {/* 무엇이 · 누구에게 · 어디에 쓰이는지를 동의 전에 분명히 (심사 5.1.2(i)).
                내용은 개인정보처리방침의 OpenAI 행과 같은 말이어야 한다 — 두 곳이 어긋나면 안 된다. */}
            <ThemedText
              variant="body"
              tone="secondary"
              style={{ marginTop: theme.spacing.s2, textAlign: 'center', lineHeight: 24 }}
            >
              {'회상 대화를 만들기 위해, 선택한 시기의 정의 글과 대화 내용이 OpenAI로 전송돼요.\n'}
              {'OpenAI는 이를 답변을 만드는 데만 쓰고, 학습에는 쓰지 않아요.'}
            </ThemedText>
            <ThemedText
              variant="sm"
              tone="secondary"
              style={{ marginTop: theme.spacing.s3, textAlign: 'center' }}
            >
              동의하지 않으면 회상만 쓸 수 없고, 다른 기능은 그대로예요.
            </ThemedText>
            {error ? (
              <ThemedText
                variant="sm"
                style={{
                  color: theme.colors.ruby.base,
                  marginTop: theme.spacing.s3,
                  textAlign: 'center',
                }}
              >
                {error}
              </ThemedText>
            ) : null}
            <Button
              label="동의하고 시작하기"
              onPress={onConsent}
              loading={submitting}
              style={{ marginTop: theme.spacing.s5, alignSelf: 'stretch' }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  scrimInner: { width: '100%' },
  sheet: {
    alignItems: 'center',
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
});
