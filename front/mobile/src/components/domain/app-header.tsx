/**
 * AppHeader — 탭 공통 상단 헤더(워드마크 + 로그인 신호등 + 잉크칩 + 마이페이지 아바타).
 *
 * 어느 탭에서든 잉크 잔액·마이페이지에 접근할 수 있게 각 탭 루트 화면 최상단에 렌더한다.
 * (단어 상세 등 push된 깊은 화면엔 넣지 않음 — 그쪽은 자체 뒤로가기 헤더만.)
 * 스크롤 콘텐츠의 첫 요소로 두는 방식이라 별도 안전영역 처리는 화면의 상단 패딩이 담당.
 *
 * 비로그인 상태:
 *   - 신규 사용자  — 포인트색 "로그인하기" 칩만 (조용한 유도, 강요 아님)
 *   - 재방문 사용자(로그인 이력 있음) — 칩 아래에 리마인드 말풍선 1회 노출(앱 실행당)
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { InkBalanceChip } from '@/components/domain/ink-balance-chip';
import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

// 앱 실행(JS 세션)당 1회만 노출 — 탭마다 AppHeader 인스턴스가 따로라 모듈 스코프로 공유.
// 매 화면 다시 뜨면 잔소리가 되므로, 닫으면 다음 실행 때까지 침묵.
let reminderDismissedThisSession = false;

export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const inkBalance = useAuthStore((s) => (s.token ? (s.user?.balance ?? 0) : null));
  const isLoggedIn = useAuthStore((s) => s.token !== null);
  const hasLoggedInBefore = useAuthStore((s) => s.hasLoggedInBefore);

  const [reminderDismissed, setReminderDismissed] = useState(reminderDismissedThisSession);
  const showReminder = !isLoggedIn && hasLoggedInBefore && !reminderDismissed;

  function dismissReminder() {
    reminderDismissedThisSession = true;
    setReminderDismissed(true);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.wordmark}>define</ThemedText>
          {/* 로그인 상태 신호등 — 로그아웃이면 "로그인하기" CTA 칩, 로그인이면 초록불. */}
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
            <PressableScale
              onPress={() => router.push('/auth')}
              hitSlop={6}
              style={[styles.loginChip, { backgroundColor: theme.colors.point.p050 }]}
            >
              <View style={[styles.authDot, { backgroundColor: theme.colors.ruby.base }]} />
              <ThemedText variant="caption" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
                로그인하기
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

      {/* 로그인 리마인드 말풍선 — 이 기기에서 로그인한 적 있는 사람이 로그아웃 상태일 때만. */}
      {showReminder ? (
        <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(150)}>
          {/* 꼬리(▲) — 위의 "로그인하기" 칩을 가리킴 */}
          <View
            style={[
              styles.bubbleTail,
              { borderBottomColor: theme.colors.point.p050 },
            ]}
          />
          <View style={[styles.bubble, { backgroundColor: theme.colors.point.p050 }]}>
            <Pressable style={styles.bubbleBody} onPress={() => router.push('/auth')} hitSlop={4}>
              <ThemedText variant="sm" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
                잠깐! 로그인이 안 되어 있어요
              </ThemedText>
              <ThemedText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                기록을 안전하게 보관하려면 로그인해 주세요
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={dismissReminder}
              hitSlop={8}
              style={styles.bubbleClose}
              accessibilityRole="button"
              accessibilityLabel="로그인 알림 닫기"
            >
              <Icon name="close" size={14} color={theme.colors.ink.placeholder} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  loginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  authDot: { width: 8, height: 8, borderRadius: 4 },
  bubbleTail: {
    // RN 삼각형 관례: 폭 0 박스의 보더로 그림. 아래(말풍선)쪽 보더만 색 지정.
    alignSelf: 'flex-start',
    marginLeft: 96, // "로그인하기" 칩 아래 근처
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: 6,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleBody: { flex: 1 },
  bubbleClose: { padding: 2, marginLeft: 8 },
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
