/**
 * RecallConsentSheet — tab3 첫 진입 AI 동의 시트(가벼운 1회).
 * 무거운 "데이터 외부 전송" 경고 대신 절제된 안내. CustomWordSheet의 Modal 패턴.
 */
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type RecallConsentSheetProps = {
  visible: boolean;
  onConsent: () => void;
  onClose: () => void;
};

export function RecallConsentSheet({ visible, onConsent, onClose }: RecallConsentSheetProps) {
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
              { backgroundColor: theme.colors.paper.base, borderColor: theme.colors.line.base },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Icon name="past" size={40} color={theme.colors.point.p600} />
            <ThemedText variant="h3" style={{ marginTop: theme.spacing.s3 }}>
              회상 시작하기
            </ThemedText>
            <ThemedText
              variant="body"
              tone="secondary"
              style={{ marginTop: theme.spacing.s2, textAlign: 'center', lineHeight: 24 }}
            >
              이 기능은 생성형 AI를 활용해, 그동안 적어온 정의로 그 시절의 나를 되살려요.
            </ThemedText>
            <Button
              label="시작하기"
              onPress={onConsent}
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
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
  },
});
