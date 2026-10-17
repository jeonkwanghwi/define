/**
 * AppHeader — 탭 공통 상단 헤더(워드마크 + 예외 상태 칩 + 잉크칩 + "마이페이지" 버튼).
 *
 * 어느 탭에서든 잉크 잔액·마이페이지에 접근할 수 있게 각 탭 루트 화면 최상단에 렌더한다.
 * (단어 상세 등 push된 깊은 화면엔 넣지 않음 — 그쪽은 자체 뒤로가기 헤더만.)
 * 스크롤 콘텐츠의 첫 요소로 두는 방식이라, **상태표시줄 인셋을 여기서 직접 더한다.**
 * (화면의 고정 패딩 24만 믿었다가 실기기에서 헤더가 시계·배터리에 깔리고
 *  우상단 아바타가 아예 안 눌렸다 — 웹·시뮬레이터는 인셋이 0이라 안 보였다.)
 *
 * 비로그인 상태:
 *   - 신규 사용자  — 포인트색 "로그인하기" 칩만 (조용한 유도, 강요 아님)
 *   - 재방문 사용자(로그인 이력 있음) — 칩 아래에 리마인드 말풍선 1회 노출(앱 실행당)
 *
 * 로그인 + 동기화 정상이면 워드마크 옆엔 **아무것도 없다.** 전에는 "● 로그인됨" 초록불이
 * 늘 떠 있었는데, 항상 같은 신호는 신호가 아니라 소음이다(그리고 토큰 밖의 초록이었다).
 * 칩은 예외 상태에서만 나타난다:
 *   - 동기화 실패 — 루비 "동기화 안 됨". 누르면 재시도할 수 있는 마이페이지로.
 *     (실패를 숨기면 서버가 죽어도 사용자는 기록이 안전하다고 믿는다.)
 *   - 로그아웃 — 포인트색 "로그인하기". 경보가 아니라 권유라 루비 점은 뺐다(루비 = 경보).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InkBalanceChip } from '@/components/domain/ink-balance-chip';
import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useAuthStore } from '@/store/auth-store';
import { controlPresets, motion, radii, spacing, useTheme } from '@/theme';

// 앱 실행(JS 세션)당 1회만 노출 — 탭마다 AppHeader 인스턴스가 따로라 모듈 스코프로 공유.
// 매 화면 다시 뜨면 잔소리가 되므로, 닫으면 다음 실행 때까지 침묵.
let reminderDismissedThisSession = false;

export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inkBalance = useAuthStore((s) => (s.token ? (s.user?.balance ?? 0) : null));
  const isLoggedIn = useAuthStore((s) => s.token !== null);
  const hasLoggedInBefore = useAuthStore((s) => s.hasLoggedInBefore);
  const syncFailed = useAuthStore((s) => s.syncFailedAt !== null);

  const [reminderDismissed, setReminderDismissed] = useState(reminderDismissedThisSession);
  const showReminder = !isLoggedIn && hasLoggedInBefore && !reminderDismissed;

  function dismissReminder() {
    reminderDismissedThisSession = true;
    setReminderDismissed(true);
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.wordmark}>define</ThemedText>
          {/* 예외 상태 칩 — 동기화 실패 / 로그아웃일 때만. 정상 로그인이면 아무것도 안 그린다. */}
          {isLoggedIn ? (
            syncFailed ? (
              // 동기화 실패 — 마이페이지에서 재시도할 수 있으니 눌러서 갈 수 있게 한다.
              <PressableScale
                onPress={() => router.push('/mypage')}
                hitSlop={6}
                style={[styles.loginChip, { backgroundColor: theme.colors.ruby.soft }]}
              >
                <View style={[styles.authDot, { backgroundColor: theme.colors.ruby.base }]} />
                <ThemedText
                  variant="caption"
                  style={{ color: theme.colors.ruby.base, fontWeight: '700' }}
                >
                  동기화 안 됨
                </ThemedText>
              </PressableScale>
            ) : null
          ) : (
            <PressableScale
              onPress={() => router.push('/auth')}
              hitSlop={6}
              style={[styles.loginChip, { backgroundColor: theme.colors.point.p050 }]}
            >
              <ThemedText variant="caption" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
                로그인하기
              </ThemedText>
            </PressableScale>
          )}
        </View>

        <View style={styles.headerRight}>
          {inkBalance != null && <InkBalanceChip balance={inkBalance} />}
          {/* 마이페이지 버튼 — 전엔 이니셜만 든 동그라미라 "눌리는 건지, 뭐로 가는지" 몰랐다.
              글자 "마이페이지"만 둔다(썸네일 없이). 높이·배경은 옆 잉크칩과 같은 pill 프리셋. */}
          <PressableScale
            onPress={() => router.push('/mypage')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="마이페이지"
            style={[
              styles.mypageBtn,
              // 잉크 칩과 같은 테두리 — 라이트에서 바탕만으론 버튼으로 안 읽힌다.
              { backgroundColor: theme.colors.surface.nested, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: theme.colors.line.base },
            ]}
          >
            {/* 줄바꿈·말줄임 금지 — 좁은 폭에선 간격을 먼저 줄인다(글자는 안 줄임). */}
            <ThemedText
              variant="sm"
              numberOfLines={1}
              style={{ color: theme.colors.ink.secondary, fontWeight: '700' }}
            >
              마이페이지
            </ThemedText>
          </PressableScale>
        </View>
      </View>

      {/* 로그인 리마인드 말풍선 — 이 기기에서 로그인한 적 있는 사람이 로그아웃 상태일 때만. */}
      {showReminder ? (
        <Animated.View
          entering={FadeInDown.duration(motion.duration.slow)}
          exiting={FadeOut.duration(motion.duration.fast)}
        >
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
  wrap: { marginBottom: spacing.s5 },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2 },
  loginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...controlPresets.pill,
    borderRadius: radii.pill,
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
  mypageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    ...controlPresets.pill,
    borderRadius: radii.pill,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2 },
});
