/**
 * 마이페이지 — 프로필 · 화면(테마) · 설정 · 로드맵 · 버전.
 *
 * 진입: 메인(기록) 화면 헤더 우상단 아바타 버튼 → router.push('/mypage').
 * (tabs) 밖의 루트 Stack 화면이라 탭바 위를 덮는 풀스크린 + 자체 back 헤더.
 *
 * 범위 (P0+P1):
 *   - 프로필: 닉네임(서버 저장·중복 방지, 로그인 필요) + 실제 기록 통계. 탭하면 닉네임 시트.
 *   - 화면: ThemeModeToggle (라이트/다크/시스템) — 다크 모드 복원 입구.
 *   - 설정: 닉네임 변경 / 진동 피드백 on-off / 알림(준비 중)
 *   - 지원: 버그 제보·문의 (준비 중 — 위치는 헤더 아닌 마이페이지로 결정)
 *   - 곧 만나요: 프리미엄 테마·폰트 (BM 로드맵, 비활성). PDF 내보내기는 단어장 탭으로 이동함
 *   - 버전 정보
 *
 * 의도적으로 뺀 것:
 *   - 루비/연속 출석 등 게이미피케이션 수치 → 기획 미확정 + 메인 노출 정책 보류라 가짜 수치 X.
 *   - "데이터 초기화" → Task #14에서 디버그 편의로 판정되어 제거 확정. 정식 "전체 삭제"는 P2로 분리.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { NicknameSheet } from '@/components/domain/nickname-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
import { ThemeModeToggle } from '@/components/domain/theme-mode-toggle';
import { ConfirmDialog, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import { API_BASE } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStats, useJournalStreak } from '@/store/journal-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/**
 * 방침 페이지가 올라가는 웹 주소 — API_BASE에서 '/api'를 떼어 만든다.
 * 둘이 같은 CloudFront 배포라 주소가 갈라질 일이 없다.
 */
const WEB_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export default function MyPageScreen() {
  const theme = useTheme();
  const router = useRouter();

  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const stats = useJournalStats();
  const streak = useJournalStreak();

  const haptics = useSettingsStore((s) => s.haptics);
  const setHaptics = useSettingsStore((s) => s.setHaptics);

  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);
  const token = useAuthStore((s) => s.token);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const accountEmail = useAuthStore((s) => s.user?.email ?? null);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const syncFailedAt = useAuthStore((s) => s.syncFailedAt);
  const retrySync = useAuthStore((s) => s.retrySync);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 탈퇴 실패는 조용히 넘기면 안 된다 — 사용자는 지워진 줄 안다.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { failed } = await deleteAccount();
      setDeleteOpen(false);
      // 제공자 연결을 못 끊었으면 사용자가 직접 끊도록 알려야 한다(조용히 삼키면 연결이 남는다).
      if (failed.length > 0) {
        setDeleteError(
          `계정은 삭제했지만 ${failed.join('·')} 연결 해제에 실패했어요. ` +
            `해당 서비스 설정에서 직접 해제해 주세요.`,
        );
      } else {
        router.replace('/');
      }
    } catch {
      setDeleteError('탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }
  // 재시도 중 표시는 이 화면에서만 필요해 로컬 state로 둔다(store에 두면 영속돼 "동기화 중"이 박힌다).
  const [retrying, setRetrying] = useState(false);

  async function handleRetrySync() {
    if (retrying) return;
    setRetrying(true);
    await retrySync(); // 성공/실패 표시는 store가 갱신 — 여기선 진행 중 표시만 담당
    setRetrying(false);
  }

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
                value={
                  retrying
                    ? '동기화 중…'
                    : syncFailedAt
                      ? '동기화 안 됨 · 다시 시도'
                      : lastSyncedAt
                        ? '동기화됨'
                        : undefined
                }
                valueColor={syncFailedAt && !retrying ? theme.colors.ruby.base : undefined}
                onPress={syncFailedAt && !retrying ? handleRetrySync : undefined}
              />
              {syncFailedAt ? (
                <ThemedText variant="caption" tone="secondary" style={styles.syncNote}>
                  기록은 이 폰에 안전하게 있어요. 서버 반영만 실패했어요.
                </ThemedText>
              ) : null}
              <Divider theme={theme} />
              <Row
                theme={theme}
                icon="close"
                label="로그아웃"
                onPress={() => setLogoutOpen(true)}
              />
              <Divider theme={theme} />
              <Row
                theme={theme}
                icon="trash"
                label="회원 탈퇴"
                value={deleting ? '탈퇴하는 중…' : undefined}
                valueColor={theme.colors.ruby.base}
                onPress={() => setDeleteOpen(true)}
                disabled={deleting}
              />
              {deleteError ? (
                <ThemedText variant="caption" style={[styles.syncNote, { color: theme.colors.ruby.base }]}>
                  {deleteError}
                </ThemedText>
              ) : null}
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
          {/* 진동 피드백 on/off — 진동에 민감한 사람이 끌 수 있어야 한다(접근성).
              별도 스위치 UI를 들이지 않고 옆줄과 같은 Row로 값만 보여준다(탭하면 토글). */}
          <Row
            theme={theme}
            icon="settings"
            label="진동 피드백"
            value={haptics ? '켬' : '끔'}
            onPress={() => setHaptics(!haptics)}
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

        {/* ─── 지원 ───
            버그 제보/문의 진입점. 위치는 헤더가 아니라 여기로 결정(저빈도 액션·표준 관례).
            기능(이메일 열기/인앱 폼→서버/외부 폼)은 추후 구현 — 지금은 비활성 placeholder. */}
        <SectionLabel theme={theme} text="지원" />
        <Group theme={theme}>
          <Row
            theme={theme}
            icon="send"
            label="버그 제보 · 문의"
            value="준비 중"
            disabled
          />
          <Divider theme={theme} />
          {/* 수집 항목·공개 범위를 사용자가 확인할 수 있어야 한다(스토어 심사 요건이기도 하다).
              웹 빌드와 함께 배포되는 정적 페이지라 앱 업데이트 없이 갱신할 수 있다. */}
          <Row
            theme={theme}
            icon="lock"
            label="개인정보처리방침"
            onPress={() => Linking.openURL(`${WEB_ORIGIN}/privacy.html`)}
          />
        </Group>

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
        visible={deleteOpen}
        title="정말 탈퇴할까요?"
        message={
          '기록한 단어와 정의가 모두 삭제돼요.\n' +
          '이 기기에 저장된 것도 함께 지워지고, 되돌릴 수 없어요.'
        }
        confirmLabel={deleting ? '탈퇴하는 중…' : '탈퇴하기'}
        onConfirm={handleDeleteAccount}
        onClose={() => setDeleteOpen(false)}
      />

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
  valueColor,
  onPress,
  disabled,
}: {
  theme: Theme;
  icon: IconName;
  label: string;
  value?: string;
  /** 값 글자색 지정(기본은 placeholder 톤). 경고를 색으로 구분할 때만 넘긴다. */
  valueColor?: string;
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
        <ThemedText
          variant="sm"
          tone="placeholder"
          style={[{ marginRight: 6 }, valueColor ? { color: valueColor, fontWeight: '700' } : null]}
        >
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
  syncNote: { paddingHorizontal: 16, paddingBottom: 12, marginTop: -4 },
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
