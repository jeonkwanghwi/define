/**
 * VerifyIdentityMock — 이메일 가입의 본인인증(PASS) 자리 표시 목업.
 * 실제 PASS 연동 전까지 "인증 완료" 버튼만. auth.tsx의 step='verify'에서 렌더.
 * presentational — 상태/네트워크 없음, 콜백만 받는다.
 */
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type VerifyIdentityMockProps = {
  onComplete: () => void;
  submitting?: boolean;
};

export function VerifyIdentityMock({ onComplete, submitting }: VerifyIdentityMockProps) {
  const theme = useTheme();
  return (
    <ThemedView bg="paper" style={styles.container}>
      <Icon name="lock" size={48} color={theme.colors.point.p600} />
      <ThemedText variant="h2" style={{ marginTop: theme.spacing.s4 }}>
        본인인증
      </ThemedText>
      <ThemedText
        variant="body"
        tone="secondary"
        style={{ marginTop: theme.spacing.s2, textAlign: 'center', lineHeight: 24 }}
      >
        안전한 가입을 위해 본인인증이 필요해요.{'\n'}(지금은 준비 중 — 아래 버튼으로 진행)
      </ThemedText>
      <View style={{ height: theme.spacing.s6 }} />
      <Button
        label="인증 완료"
        onPress={onComplete}
        loading={submitting}
        fullWidth
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});
