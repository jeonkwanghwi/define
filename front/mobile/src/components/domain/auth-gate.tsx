/**
 * AuthGate — 인증 여부에 따라 children ↔ 가입 유도 잠금 화면을 고르는 래퍼.
 *
 * 가입 필요 탭(광장·회고·과거의나)에서 로그아웃 사용자에게 placeholder 대신
 * "가입하고 시작하기" CTA를 노출해 /auth로 유도(§5 탭 게이팅 정책).
 * 로그인 사용자에겐 children(현재는 ScreenPlaceholder)을 그대로 보여준다.
 *
 * 사용:
 *   <AuthGate icon="plaza" title="광장" description="…">
 *     <ScreenPlaceholder ... />
 *   </AuthGate>
 */
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export type AuthGateProps = {
  /** 탭 아이콘 (plaza/mood/past). */
  icon: IconName;
  /** 탭 이름. */
  title: string;
  /** 왜/무엇이 열리는지 — 탭별 유도 문구. */
  description: string;
  /** 로그인 사용자가 볼 콘텐츠(현재는 ScreenPlaceholder). */
  children: ReactNode;
};

export function AuthGate({ icon, title, description, children }: AuthGateProps) {
  const theme = useTheme();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  // 로그인 상태면 실제 콘텐츠 그대로.
  if (token) {
    return <>{children}</>;
  }

  // 로그아웃 상태면 가입 유도 잠금 화면.
  return (
    <ThemedView bg="paper" style={styles.container}>
      <Icon name={icon} size={56} color={theme.colors.point.p600} />
      <ThemedText variant="h2" style={{ marginTop: theme.spacing.s4 }}>
        {title}
      </ThemedText>
      <ThemedText
        variant="body"
        tone="secondary"
        style={{ marginTop: theme.spacing.s2, textAlign: 'center', lineHeight: 24 }}
      >
        {description}
      </ThemedText>

      <View style={[styles.lockRow, { marginTop: theme.spacing.s6 }]}>
        <Icon name="lock" size={15} color={theme.colors.ink.placeholder} />
        <ThemedText variant="caption" tone="placeholder">
          가입한 분들에게 열려요
        </ThemedText>
      </View>

      <Button
        label="가입하고 시작하기"
        onPress={() => router.push('/auth')}
        style={{ marginTop: theme.spacing.s5 }}
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
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
