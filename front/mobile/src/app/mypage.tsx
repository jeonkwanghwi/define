/**
 * 마이페이지 — 프로필 · 화면(테마) · 설정 · 로드맵 · 버전.
 *
 * 진입: 메인(기록) 화면 헤더 우상단 아바타 버튼 → router.push('/mypage').
 * (tabs) 밖의 루트 Stack 화면이라 탭바 위를 덮는 풀스크린 + 자체 back 헤더.
 *
 * 범위 (P0+P1):
 *   - 프로필: 닉네임(서버 저장·중복 방지, 로그인 필요) + 실제 기록 통계. 탭하면 닉네임 시트.
 *   - 화면: ThemeModeToggle (라이트/다크/시스템) — 다크 모드 복원 입구.
 *   - 설정: 닉네임 변경 / 알림(준비 중)
 *   - 곧 만나요: 프리미엄 테마·폰트 / 단어장 PDF 내보내기 (BM 로드맵, 비활성)
 *   - 버전 정보
 *
 * 의도적으로 뺀 것:
 *   - 루비/연속 출석 등 게이미피케이션 수치 → 기획 미확정 + 메인 노출 정책 보류라 가짜 수치 X.
 *   - "데이터 초기화" → Task #14에서 디버그 편의로 판정되어 제거 확정. 정식 "전체 삭제"는 P2로 분리.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { NicknameSheet } from '@/components/domain/nickname-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
import { ThemeModeToggle } from '@/components/domain/theme-mode-toggle';
import { ConfirmDialog, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStats, useJournalStreak } from '@/store/journal-store';
import { useTheme } from '@/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function MyPageScreen() {
  const theme = useTheme();
  const router = useRouter();

  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const stats = useJournalStats();
  const streak = useJournalStreak();

  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);
  const token = useAuthStore((s) => s.token);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const accountEmail = useAuthStore((s) => s.user?.email ?? null);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const logout = useAuthStore((s) => s.logout);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const hasNickname = nickname.length > 0;
  const avatarLetter = hasNickname ? nickname[0] : '';

  // 닉네임은 서버 저장(중복 검사) — 비로그인이면 편집 대신 로그인 화면으로.
  function openNicknameEditor() {
    if (!token) {
      router.push('/auth');
      return;
    }
    setNicknameSheetOpen(true);
  }

  // 프로필 부제 — 실제 기록 통계 (가짜 수치 없이)
  // 연속 기록은 2일 이상일 때만 — "1일 연속"은 의미가 약하고, 0일은 압박이 되므로 생략.
  const statLine =
    stats.totalEntries === 0
      ? '아직 정의한 단어가 없어요'
      : `총 ${stats.totalEntries}번의 정의 · ${stats.uniqueWords}개 단어` +
        (stats.changedWords > 0 ? ` · 생각이 바뀐 단어 ${stats.changedWords}개` : '') +
        (streak.currentStreak >= 2 ? ` · ${streak.currentStreak}일 연속 기록` : '');

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title="마이페이지" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 프로필 ─── */}
        <PressableScale
          onPress={openNicknameEditor}
          style={styles.profile}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.colors.point.p100,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            {hasNickname ? (
              <ThemedText
                style={{ ...theme.typography.h2, color: theme.colors.point.p600 }}
              >
                {avatarLetter}
              </ThemedText>
            ) : (
              <Icon name="user" size={30} color={theme.colors.point.p500} />
            )}
          </View>
          <View style={styles.profileText}>
            <View style={styles.nameRow}>
              <ThemedText variant="h3">
                {hasNickname
                  ? nickname
                  : token
                    ? '닉네임을 정해보세요'
                    : '로그인하고 닉네임을 정해보세요'}
              </ThemedText>
              <Icon name="edit" size={15} color={theme.colors.ink.placeholder} />
            </View>
            <ThemedText
              variant="caption"
              tone="placeholder"
              style={{ marginTop: 4 }}
            >
              {statLine}
            </ThemedText>
          </View>
        </PressableScale>

        {/* ─── 계정 ─── */}
        <SectionLabel theme={theme} text="계정" />
        <Group theme={theme}>
          {token ? (
            <>
              <Row
                theme={theme}
                icon="user"
                label={accountEmail ?? '로그인됨'}
                value={lastSyncedAt ? '동기화됨' : undefined}
              />
              <Divider theme={theme} />
              <Row
                theme={theme}
                icon="close"
                label="로그아웃"
                onPress={() => setLogoutOpen(true)}
              />
            </>
          ) : (
            <Row
              theme={theme}
              icon="user"
              label="로그인 / 회원가입"
              onPress={() => router.push('/auth')}
            />
          )}
        </Group>

        {/* ─── 화면 (테마) ─── */}
        <SectionLabel theme={theme} text="화면" />
        <ThemeModeToggle />
        <ThemedText
          variant="caption"
          tone="placeholder"
          style={{ marginTop: theme.spacing.s2 }}
        >
          {theme.mode === 'dark'
            ? '밤에도 눈이 편한 다크 톤이에요'
            : '따뜻한 페이퍼 톤. 시스템을 고르면 기기 설정을 따라요'}
        </ThemedText>

        {/* ─── 설정 ─── */}
        <SectionLabel theme={theme} text="설정" />
        <Group theme={theme}>
          <Row
            theme={theme}
            icon="user"
            label="닉네임 변경"
            value={token ? (hasNickname ? nickname : '미설정') : '로그인 필요'}
            onPress={openNicknameEditor}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon="bell"
            label="알림 설정"
            value="준비 중"
            disabled
          />
        </Group>

        {/* ─── 잉크(재화) — 로그인 사용자만 ─── */}
        {token && (
          <>
            <SectionLabel theme={theme} text="잉크" />
            <Group theme={theme}>
              <Row theme={theme} icon="ink" label="내 잉크" value={`${balance}개`} />
            </Group>
          </>
        )}

        {/* ─── 곧 만나요 (BM 로드맵) ─── */}
        <SectionLabel theme={theme} text="곧 만나요" />
        <Group theme={theme}>
          <Row
            theme={theme}
            icon="sparkle"
            label="프리미엄 테마 · 폰트"
            value="준비 중"
            disabled
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon="book"
            label="단어장 PDF 내보내기"
            value="준비 중"
            disabled
          />
        </Group>

        {/* ─── 버전 ─── */}
        <View style={styles.footer}>
          <ThemedText variant="caption" tone="placeholder">
            define · 버전 {APP_VERSION}
          </ThemedText>
          <ThemedText
            variant="caption"
            tone="placeholder"
            style={{ marginTop: 4 }}
          >
            우린 모두 각자의 정의가 있다
          </ThemedText>
        </View>
      </ScrollView>

      {/* 닉네임 편집 시트 */}
      <NicknameSheet
        visible={nicknameSheetOpen}
        current={nickname}
        onSave={updateNickname}
        onClose={() => setNicknameSheetOpen(false)}
      />

      {/* 로그아웃 확인 (시스템 Alert X) */}
      <ConfirmDialog
        visible={logoutOpen}
        title="로그아웃할까요?"
        message="기록한 단어는 이 기기에 그대로 남아요."
        confirmLabel="로그아웃"
        onConfirm={logout}
        onClose={() => setLogoutOpen(false)}
      />
    </ThemedView>
  );
}

// ─── 내부 프레젠테이션 컴포넌트 ──────────────────────────────────────

type Theme = ReturnType<typeof useTheme>;

function SectionLabel({ theme, text }: { theme: Theme; text: string }) {
  return (
    <ThemedText
      variant="caption"
      style={{
        color: theme.colors.point.p600,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginTop: theme.spacing.s8,
        marginBottom: theme.spacing.s3,
      }}
    >
      {text}
    </ThemedText>
  );
}

function Group({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <View
      style={[
        styles.group,
        {
          backgroundColor: theme.colors.surface.base,
          borderColor: theme.colors.line.base,
          borderRadius: theme.radii.lg,
        },
        theme.shadows.sm,
      ]}
    >
      {children}
    </View>
  );
}

function Divider({ theme }: { theme: Theme }) {
  return <View style={{ height: 1, backgroundColor: theme.colors.line.base, marginLeft: 52 }} />;
}

function Row({
  theme,
  icon,
  label,
  value,
  onPress,
  disabled,
}: {
  theme: Theme;
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[styles.row, { backgroundColor: 'transparent' }, disabled && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={19} color={theme.colors.ink.secondary} />
      <ThemedText variant="body" tone="strong" style={{ flex: 1, marginLeft: 12 }} numberOfLines={1}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText variant="sm" tone="placeholder" style={{ marginRight: 6 }}>
          {value}
        </ThemedText>
      ) : null}
      {onPress ? (
        <Icon name="chevronR" size={16} color={theme.colors.ink.placeholder} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  group: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },

  footer: {
    alignItems: 'center',
    marginTop: 36,
  },
});
