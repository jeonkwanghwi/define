/**
 * AppHeader — 탭 공통 상단 헤더(워드마크 + 로그인 신호등 + 잉크칩 + 마이페이지 아바타).
 *
 * 어느 탭에서든 잉크 잔액·마이페이지에 접근할 수 있게 각 탭 루트 화면 최상단에 렌더한다.
 * (단어 상세 등 push된 깊은 화면엔 넣지 않음 — 그쪽은 자체 뒤로가기 헤더만.)
 * 스크롤 콘텐츠의 첫 요소로 두는 방식이라 별도 안전영역 처리는 화면의 상단 패딩이 담당.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { InkBalanceChip } from '@/components/domain/ink-balance-chip';
import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const nickname = useSettingsStore((s) => s.nickname);
  const inkBalance = useAuthStore((s) => (s.token ? (s.user?.balance ?? 0) : null));
  const isLoggedIn = useAuthStore((s) => s.token !== null);

  return (
    <View style={styles.appHeader}>
      <View style={styles.headerLeft}>
        <ThemedText style={styles.wordmark}>define</ThemedText>
        {/* 로그인 상태 신호등 — 로그아웃이면 빨간불(탭하면 로그인), 로그인이면 초록불. 강요 아님. */}
        {isLoggedIn ? (
          <View style={styles.authPill}>
            <View
              style={[
                styles.authDot,
                { backgroundColor: theme.mode === 'dark' ? '#4ABF8A' : '#2E9E6B' },
              ]}
            />
            <ThemedText variant="caption" tone="secondary">
              로그인됨
            </ThemedText>
          </View>
        ) : (
          <PressableScale onPress={() => router.push('/auth')} hitSlop={6} style={styles.authPill}>
            <View style={[styles.authDot, { backgroundColor: theme.colors.ruby.base }]} />
            <ThemedText variant="caption" tone="secondary">
              로그인 안됨
            </ThemedText>
          </PressableScale>
        )}
      </View>

      <View style={styles.headerRight}>
        {inkBalance != null && <InkBalanceChip balance={inkBalance} />}
        <PressableScale
          onPress={() => router.push('/mypage')}
          hitSlop={8}
          style={[
            styles.avatarBtn,
            { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base },
          ]}
        >
          {nickname.length > 0 ? (
            <ThemedText
              variant="bodyMd"
              style={{ color: theme.colors.point.p600, fontWeight: '700' }}
            >
              {nickname[0]}
            </ThemedText>
          ) : (
            <Icon name="user" size={19} color={theme.colors.ink.secondary} />
          )}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  wordmark: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authDot: { width: 8, height: 8, borderRadius: 4 },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
