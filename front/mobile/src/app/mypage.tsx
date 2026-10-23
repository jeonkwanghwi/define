/**
 * 마이페이지 — 프로필 · 화면(테마) · 설정 · 로드맵 · 버전.
 *
 * 진입: 메인(기록) 화면 헤더 우상단 아바타 버튼 → router.push('/mypage').
 * (tabs) 밖의 루트 Stack 화면이라 탭바 위를 덮는 풀스크린 + 자체 back 헤더.
 *
 * 범위 (P0+P1):
 *   - 프로필: 닉네임(서버 저장·중복 방지, 로그인 필요) + 실제 기록 통계. 탭하면 닉네임 시트.
 *   - 화면: ThemeModeToggle (라이트/다크/시스템) — 다크 모드 복원 입구.
 *   - 테마: PalettePicker — 포인트 색 계열(호박·와인·쪽빛…) 고르기.
 *   - 설정: 닉네임 변경 / 진동 피드백 on-off / 알림(준비 중)
 *   - 지원: 버그 제보 (시트에 제목·내용 → 서버가 운영자 메일로. 로그인 필요) /
 *           차단한 사용자 (목록 시트에서 해제 — 차단만 되고 풀 수 없으면 불친절하다) / 이용약관 / 개인정보처리방침
 *   - 곧 만나요: 프리미엄 테마·폰트 (BM 로드맵, 비활성). PDF 내보내기는 단어장 탭으로 이동함
 *   - 버전 정보
 *
 * 의도적으로 뺀 것:
 *   - 루비/연속 출석 등 게이미피케이션 수치 → 기획 미확정 + 메인 노출 정책 보류라 가짜 수치 X.
 *   - "데이터 초기화" → Task #14에서 디버그 편의로 판정되어 제거 확정. 정식 "전체 삭제"는 P2로 분리.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { BugReportSheet } from '@/components/domain/bug-report-sheet';
import { NicknameSheet } from '@/components/domain/nickname-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
import { ThemeModeToggle } from '@/components/domain/theme-mode-toggle';
import { WatchAdButton } from '@/components/domain/watch-ad-button';
import { ActionSheet, Button, ConfirmDialog, FadeIn, PressableScale, useToast } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import { hapticError, hapticSuccess, hapticTap, hapticWarning } from '@/lib/haptics';
import { toSuffix } from '@/lib/korean';
import { DOCS_ORIGIN, openDoc } from '@/lib/open-doc';
import { countUnsynced, syncJournal, useUnuploadableCount } from '@/lib/sync-journal';
import { API_BASE } from '@/services/api-client';
import { sendFeedback } from '@/services/feedback-api';
import {
  getBlockedUsers,
  unblockUser,
  type PlazaBlockedUser,
} from '@/services/plaza-api';
import { useAuthStore, type LoginMethod } from '@/store/auth-store';
import { useJournalStats, useJournalStore, useJournalStreak } from '@/store/journal-store';
import { useSettingsStore } from '@/store/settings-store';
import { getColors, PALETTE_IDS, PALETTES, useTheme, type PaletteId } from '@/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/**
 * 아직 만들지 않은 메뉴를 가린다 (2026-10-12).
 *
 * Apple 심사 가이드 2.1이 "placeholder text … incomplete features"를 리젝 사유로 든다.
 * "준비 중"이라고 적어둔 행은 심사자에게 **아직 안 만든 기능을 메뉴에 깔아둔 앱**으로 보이고,
 * 사용자에게는 지킬 수 없는 기대를 준다. 없는 기능은 메뉴에서 빼는 게 손해가 아니다.
 *
 * **지우지 않고 가린다** — 아래 Row는 그대로 살아 있어서 기능이 준비되면 이 상수만 true로
 * 바꾸면 돌아온다. 실제 구현은 DEVELOPMENT.md "다음 후보 — 마이페이지 후속"에 있다.
 */
const SHOW_NOTIFICATION_SETTING = false;
const SHOW_PREMIUM_THEME = false;

const LOGIN_METHOD_LABEL: Record<LoginMethod, string> = { email: '이메일', kakao: '카카오', apple: 'Apple' };

export default function MyPageScreen() {
  const theme = useTheme();
  const router = useRouter();
  // 헤더 잉크 칩에서 오면 section='ink' — 잉크 섹션까지 스르륵 내려가 "그게 뭔지"에 바로 답한다.
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scrolledToInk = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const { show } = useToast();
  const stats = useJournalStats();
  const streak = useJournalStreak();

  const haptics = useSettingsStore((s) => s.haptics);
  const setHaptics = useSettingsStore((s) => s.setHaptics);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const palette = useSettingsStore((s) => s.palette);
  const setPalette = useSettingsStore((s) => s.setPalette);

  // 바뀐 건 앱 전체 색이 바로 보여준다 — 토스트는 "무엇으로" 바뀌었는지 말만 한다.
  function choosePalette(id: PaletteId) {
    if (id === palette) return;
    setPalette(id);
    hapticTap();
    const { label } = PALETTES[id];
    show(`테마를 ${label}${toSuffix(label)} 바꿨어요`);
  }

  /**
   * 진동 켜기/끄기 — 스위치 하나만 바뀌면 눈치채기 어렵다. 켜면 **실제로 한 번 울려**
   * 무엇이 켜졌는지 몸으로 알게 하고, 어느 쪽이든 토스트로 말한다.
   * setHaptics가 먼저여야 hapticSuccess가 새 설정(켬)을 읽는다.
   */
  function toggleHaptics() {
    const next = !haptics;
    setHaptics(next);
    if (next) hapticSuccess();
    show(next ? '진동을 켰어요' : '진동을 껐어요');
  }

  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);
  const [bugSheetOpen, setBugSheetOpen] = useState(false);
  const token = useAuthStore((s) => s.token);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const accountEmail = useAuthStore((s) => s.user?.email ?? null);
  // 방법을 모르는 옛 세션: 이메일이 있으면 이메일 계정이다(소셜 계정엔 이메일이 없다).
  const loginMethod = useAuthStore((s) => s.loginMethod) ?? (accountEmail ? 'email' : null);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const syncFailedAt = useAuthStore((s) => s.syncFailedAt);
  const retrySync = useAuthStore((s) => s.retrySync);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  /**
   * 로그아웃 확인창 단계. ask = 묻기 · syncing = 못 올린 기록 올리는 중 · failed = 올리기 실패.
   * 로그아웃 뒤 다른 계정으로 로그인하면 이 폰의 기록이 지워진다 → 아직 안 올라간 게 있으면
   * 로그아웃 **전에** 올려 둔다. 실패하면 몇 개가 남는지 말하고 고르게 한다.
   */
  const [logoutStep, setLogoutStep] = useState<'closed' | 'ask' | 'syncing' | 'failed'>('closed');
  // 경고에 쓰는 개수 — 서버가 받지 않을 항목은 빼고 대기 중인 삭제는 더한 실제 미동기화 수.
  useJournalStore((s) => s.dirtyIds.length + s.pendingDeletes.length); // 바뀌면 다시 그리도록 구독만
  const unsynced = countUnsynced();
  const unuploadable = useUnuploadableCount();
  /**
   * 탈퇴 확인 단계. 0 = 닫힘 · 1 = 첫 확인 · 2 = 마지막 확인.
   *
   * 두 번 묻는 이유: 되돌릴 수 없는 유일한 행동인데 한 번 더 누르면 끝이었다.
   * 1단계는 **무엇을 잃는지**, 2단계는 **되돌릴 수 없다**만 말한다 — 같은 말을 두 번
   * 하면 두 번째가 요식이 되어 그냥 누르게 된다.
   * 두 단계는 **한 창이 내용만 바꾼다** — 닫고 새로 열면 iOS가 닫히는 중인 창 위의 새 창을 무시했다.
   */
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const stepChangedAt = useRef(0);
  const [deleting, setDeleting] = useState(false);
  // 탈퇴 실패는 조용히 넘기면 안 된다 — 사용자는 지워진 줄 안다.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * 로그아웃 — 인증만 비우고 **기록 탭으로 보낸다.**
   *
   * 전에는 상태만 비우고 이 화면에 그대로 머물렀다. 그러면 계정·잉크·기타 섹션이
   * 한꺼번에 사라지면서 **화면만 휑해지고 무슨 일이 일어났는지는 안 보인다.**
   * 탈퇴는 이미 기록 탭으로 보내고 있어 둘이 어긋나 있기도 했다.
   *
   * 기록 탭인 이유: 로그인 없이 쓸 수 있는 유일한 핵심 화면이다 —
   * 광장·회상은 로그아웃 직후 가입 유도 화면이 되어 쫓아내는 꼴이 된다.
   */
  function handleLogout() {
    setLogoutStep('closed');
    logout();
    hapticSuccess();
    show('로그아웃했어요');
    router.replace('/');
  }

  /** 로그아웃 확인 — 못 올린 기록이 있으면 먼저 올리고(창 안에서 "올리는 중…"), 다 올라가면 로그아웃. */
  async function confirmLogout() {
    if (logoutStep === 'syncing') return;
    const t = useAuthStore.getState().token;
    if (t && countUnsynced() > 0) {
      setLogoutStep('syncing');
      try {
        await syncJournal(t);
      } catch {
        // 아래에서 남은 개수로 판단한다(일부 묶음만 올라갔을 수도 있다).
      }
      if (countUnsynced() > 0) {
        hapticError();
        setLogoutStep('failed');
        return;
      }
    }
    handleLogout();
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { failed } = await deleteAccount();
      setDeleteStep(0);
      // 토큰이 사라져 이 화면의 계정 칸(인라인 문구 자리)도 같이 사라진다 → 결과는 토스트로, 기록 탭에서.
      // 제공자 연결을 못 끊었으면 사용자가 직접 끊도록 알려야 한다(조용히 삼키면 연결이 남는다).
      if (failed.length > 0) {
        const names = failed.map((p) => (p === 'apple' ? 'Apple' : p === 'kakao' ? '카카오' : p)).join('·');
        show(`탈퇴했어요 · ${names} 연결은 그 앱 설정에서 직접 끊어 주세요`, { tone: 'error' });
      } else {
        hapticSuccess();
        show('탈퇴했어요. 그동안 고마웠어요');
      }
      router.replace('/');
    } catch {
      // 실패면 아직 로그인 상태라 링크 아래 인라인 문구가 보인다. 창을 닫아 그 문구를 드러낸다.
      setDeleteStep(0);
      hapticError();
      setDeleteError('탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }
  // ─── 차단한 사용자 ───
  // 화면을 열 때 한 번 받는다(차단은 드문 행동이라 들어올 때마다 받으면 그게 낭비다).
  // 비동기 3종: 진행 중·실패·해제 중을 전부 행의 value 한 칸으로 말하고, 해제 실패만
  // 행 아래 인라인 문구로 남긴다(토스트는 성공 전용이다).
  const [blocked, setBlocked] = useState<PlazaBlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedFailed, setBlockedFailed] = useState(false);
  const [blockedSheetOpen, setBlockedSheetOpen] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  const loadBlocked = useCallback(() => {
    if (!token) return;
    setBlockedLoading(true);
    setBlockedFailed(false);
    getBlockedUsers(token)
      .then(setBlocked)
      .catch(() => setBlockedFailed(true))
      .finally(() => setBlockedLoading(false));
  }, [token]);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  /** 차단 해제 — 목록에서 지우고 토스트. 실패하면 목록을 건드리지 않는다(풀린 줄 알면 안 된다). */
  async function handleUnblock(user: PlazaBlockedUser) {
    if (!token || unblocking) return;
    setUnblocking(true);
    setBlockedError(null);
    try {
      await unblockUser(token, user.id);
      hapticSuccess();
      show(`${user.nickname} 차단을 해제했어요`);
      setBlocked((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      // 이미 인라인으로 에러를 그리는 자리라 진동을 더한다(새 에러 UI를 만들지 않는다).
      hapticError();
      setBlockedError('차단을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUnblocking(false);
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

  /**
   * 닉네임 저장 — 성공만 알린다. 실패(중복 등)는 시트가 인라인으로 그리므로
   * 에러를 삼키지 않고 그대로 올려보낸다.
   */
  async function handleSaveNickname(name: string) {
    await updateNickname(name);
    hapticSuccess();
    show('이름을 바꿨어요');
  }

  /**
   * 제보 전송 — 기기·앱 버전을 여기서 붙인다. 말로 전해지면 가장 먼저 유실되는 값들이다.
   * 웹·시뮬레이터에선 Device 값이 비는데, 없으면 그냥 안 보낸다(서버가 optional로 받는다).
   * 실패는 시트가 인라인으로 그리므로 에러를 삼키지 않고 그대로 올려보낸다.
   */
  async function handleSendFeedback(input: { title: string; body: string }) {
    if (!token) return;
    await sendFeedback(token, {
      ...input,
      appVersion: Constants.expoConfig?.version ?? undefined,
      platform: Platform.OS,
      osVersion: Device.osVersion ?? undefined,
      deviceModel: Device.modelName ?? undefined,
    });
    hapticSuccess();
    show('제보를 보냈어요. 고맙습니다');
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
  // 덩어리 안에서는 줄이 안 바뀌게 — 줄은 " · " 사이에서만 넘어간다.
  // 띄어쓰기를 줄바꿈 없는 공백(\u00A0)으로 바꾸는 것만으론 모자랐다: 한글은 **글자 사이**에서도
  // 줄이 바뀔 수 있어 "3개"가 "3 / 개"로 갈라졌다. 글자마다 사이에 단어 연결자(\u2060, 보이지 않음)를 넣는다.
  const keep = (s: string) => [...s.replace(/ /g, '\u00A0')].join('\u2060');
  const statLine =
    stats.totalEntries === 0
      ? '아직 정의한 단어가 없어요'
      : [
          keep(`총 ${stats.totalEntries}번의 정의`),
          keep(`${stats.uniqueWords}개 단어`),
          stats.changedWords > 0 ? keep(`생각이 바뀐 단어 ${stats.changedWords}개`) : null,
          streak.currentStreak >= 2 ? keep(`${streak.currentStreak}일 연속 기록`) : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title="마이페이지" />
      <ScrollView
        ref={scrollRef}
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
                    : '로그인이 필요해요'}
              </ThemedText>
              {/* 연필은 "고칠 수 있다"는 약속 — 로그인 전엔 고칠 게 없으니 숨긴다. */}
              {token ? <Icon name="edit" size={15} color={theme.colors.ink.placeholder} /> : null}
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
                icon="check"
                iconColor={theme.colors.point.p600}
                label={loginMethod ? `로그인됨 · ${LOGIN_METHOD_LABEL[loginMethod]}` : '로그인됨'}
                sansLabel
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
              {/* 이메일은 어느 계정인지 알려 주는 식별자라 함께 보여 준다. */}
              {accountEmail ? (
                <ThemedText variant="caption" tone="secondary" style={styles.syncNote}>
                  {accountEmail}
                </ThemedText>
              ) : null}
              {syncFailedAt ? (
                <ThemedText variant="caption" tone="secondary" style={styles.syncNote}>
                  기록은 이 폰에 안전하게 있어요. 서버 반영만 실패했어요.
                </ThemedText>
              ) : null}
              {/* 서버가 받지 않는 옛 기록(너무 긴 글·어긋난 날짜)은 조용히 빠진다 — 개수만큼은 말해 둔다. */}
              {unuploadable > 0 ? (
                <ThemedText variant="caption" tone="secondary" style={styles.syncNote}>
                  {`기록 ${unuploadable}개는 너무 길거나 날짜가 어긋나 이 폰에만 있어요.`}
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
        {/* 설명은 **고른 모드**를 따른다. 실제 테마(theme.mode)를 따르면 라이트 기기에서
            라이트→시스템을 골라도 아무 글자도 안 바뀌어 눌린 줄 모른다.
            key로 문구가 바뀔 때마다 새로 마운트 → 스르륵 다시 나타난다. */}
        <FadeIn key={themeMode} offset={0}>
          <ThemedText
            variant="caption"
            tone="placeholder"
            style={{ marginTop: theme.spacing.s2 }}
          >
            {themeMode === 'system'
              ? `기기 설정을 따라요 · 지금은 ${theme.mode === 'dark' ? '다크' : '라이트'}`
              : themeMode === 'dark'
                ? '밤에도 눈이 편한 다크 톤이에요'
                : '낮에 읽기 편한 밝은 화면이에요'}
          </ThemedText>
        </FadeIn>

        {/* ─── 테마 (포인트 색) ─── */}
        <SectionLabel theme={theme} text="테마" />
        <View style={styles.swatchRow} accessibilityRole="radiogroup">
          {PALETTE_IDS.map((id) => (
            <PaletteSwatch
              key={id}
              theme={theme}
              id={id}
              selected={id === palette}
              onPress={() => choosePalette(id)}
            />
          ))}
        </View>
        <ThemedText variant="caption" tone="placeholder" style={{ marginTop: theme.spacing.s2 }}>
          버튼·강조에 쓰이는 포인트 색을 바꿔요
        </ThemedText>

        {/* ─── 설정 ─── */}
        <SectionLabel theme={theme} text="설정" />
        <Group theme={theme}>
          <Row
            theme={theme}
            icon="edit"
            label="닉네임 변경"
            value={token ? (hasNickname ? nickname : '미설정') : '로그인 필요'}
            onPress={openNicknameEditor}
          />
          <Divider theme={theme} />
          {/* 진동 피드백 on/off — 진동에 민감한 사람이 끌 수 있어야 한다(접근성). */}
          <Row
            theme={theme}
            icon="vibrate"
            label="진동 피드백"
            toggle={haptics}
            onPress={toggleHaptics}
          />
          {SHOW_NOTIFICATION_SETTING && (
            <>
              <Divider theme={theme} />
              <Row theme={theme} icon="bell" label="알림 설정" value="준비 중" disabled />
            </>
          )}
        </Group>

        {/* ─── 잉크(재화) — 로그인 사용자만 ─── */}
        {token && (
          <>
            {/* onLayout 좌표로 스크롤 — 칩에서 왔을 때만. 섹션 제목이 화면 위에 살짝 걸리게 여백을 둔다. */}
            <View
              onLayout={(e) => {
                // 한 번만 — 위쪽 높이가 바뀔 때마다(테마 문구 등) 다시 끌려 내려가지 않게.
                if (section === 'ink' && !scrolledToInk.current) {
                  scrolledToInk.current = true;
                  scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 16), animated: true });
                }
              }}
            >
              <SectionLabel theme={theme} text="잉크" />
            </View>
            <Group theme={theme}>
              {/* 단위는 앱 전체에서 "잉크 N개" 하나로 — 헤더 칩·회상 버튼·토스트와 같은 말. */}
              <Row theme={theme} icon="ink" label="내 잉크" value={`${balance}개`} />
            </Group>
            {/* 잉크가 무엇에 쓰이고 어떻게 모이는지 — 앱 어디에도 설명이 없었다. */}
            <ThemedText
              variant="caption"
              tone="placeholder"
              style={{ marginTop: theme.spacing.s2, paddingHorizontal: theme.spacing.s1 }}
            >
              {/* 두 문장을 한 줄에 이으면 좁은 폭에서 낱말 중간이 끊긴다 → 문장 단위로 줄을 나눈다. */}
              {'회상에서 그때의 나와 대화할 때 써요\n매일 들르거나 연속으로 기록하면 쌓여요'}
            </ThemedText>
            {/* 평소에 잉크를 모으는 자리 — 잔액 바로 아래가 가장 자연스럽다.
                서버가 쿼터를 못 주면 이 버튼은 스스로 사라진다(watch-ad-button.tsx 참고). */}
            <WatchAdButton style={{ marginTop: theme.spacing.s3 }} />
          </>
        )}

        {/* ─── 지원 ───
            버그 제보 진입점. 위치는 헤더가 아니라 여기로 결정(저빈도 액션·표준 관례).
            로그인한 사람만 보낼 수 있다 — 서버가 JWT를 요구한다(인증 없는 메일 발송은 스팸 통로). */}
        <SectionLabel theme={theme} text="지원" />
        <Group theme={theme}>
          <Row
            theme={theme}
            icon="send"
            label="버그 제보"
            value={token ? undefined : '로그인 필요'}
            onPress={token ? () => setBugSheetOpen(true) : undefined}
            disabled={!token}
          />
          <Divider theme={theme} />
          {/* 차단 유저 — 광장에서 차단한 사람을 여기서 풀 수 있어야 한다(Apple 심사 가이드 1.2).
              라벨을 네 글자로 맞춘 이유: 버그 제보·고객 지원과 나란히 떨어지게.
              차단한 사람이 없으면 '없음'으로 비활성 — 빈 시트를 열어 보게 만들 이유가 없다. */}
          <Row
            theme={theme}
            // 자물쇠는 개인정보처리방침이 쓴다 — 차단은 "광장의 사람들"에 관한 일이라 광장 아이콘.
            icon="plaza"
            label="차단 유저"
            value={
              !token
                ? '로그인 필요'
                : blockedLoading
                  ? '불러오는 중…'
                  : blockedFailed
                    ? '불러오지 못했어요 · 다시 시도'
                    : unblocking
                      ? '해제하는 중…'
                      : blocked.length === 0
                        ? '없음'
                        : `${blocked.length}명`
            }
            valueColor={blockedFailed ? theme.colors.ruby.base : undefined}
            onPress={
              blockedFailed
                ? loadBlocked
                : blocked.length > 0
                  ? () => setBlockedSheetOpen(true)
                  : undefined
            }
            disabled={!token || blockedLoading || unblocking}
          />
          {blockedError ? (
            <ThemedText variant="caption" style={[styles.syncNote, { color: theme.colors.ruby.base }]}>
              {blockedError}
            </ThemedText>
          ) : null}
          <Divider theme={theme} />
          {/* 자주 묻는 것·문의 주소. App Store의 지원 URL과 같은 페이지다 —
              스토어에서만 닿고 앱 안에서는 못 여는 건 앞뒤가 안 맞는다. */}
          <Row
            theme={theme}
            icon="help"
            label="고객 지원"
            onPress={() => openDoc(`${DOCS_ORIGIN}/support.html`, theme)}
          />
          <Divider theme={theme} />
          {/* 가입 화면에서 "동의하게 돼요"라고 말한 문서 — 가입 뒤에도 다시 열어볼 수 있어야 한다. */}
          <Row
            theme={theme}
            icon="book"
            label="이용약관"
            onPress={() => openDoc(`${DOCS_ORIGIN}/terms.html`, theme)}
          />
          <Divider theme={theme} />
          {/* 수집 항목·공개 범위를 사용자가 확인할 수 있어야 한다(스토어 심사 요건이기도 하다).
              웹 빌드와 함께 배포되는 정적 페이지라 앱 업데이트 없이 갱신할 수 있다. */}
          <Row
            theme={theme}
            icon="lock"
            label="개인정보처리방침"
            onPress={() => openDoc(`${DOCS_ORIGIN}/privacy.html`, theme)}
          />
        </Group>

        {/* ─── 곧 만나요 (BM 로드맵) — 기능이 준비될 때까지 가린다 ─── */}
        {SHOW_PREMIUM_THEME && (
          <>
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
          </>
        )}

        {/* ─── 로그아웃 ───
            행 목록이 아니라 버튼으로, 맨 아래에 홀로 둔다.
            계정 섹션 안에 끼워 두면 설정 항목들 사이에서 실수로 눌린다.
            ghost인 이유: 되돌릴 수 있는 일이다. 분홍(danger)으로 칠하면 위험해 보이기만
            한다 — 위험의 크기와 색의 세기를 맞춘다. */}
        {token && (
          <Button
            label="로그아웃"
            variant="ghost"
            fullWidth
            onPress={() => setLogoutStep('ask')}
            style={styles.logoutButton}
          />
        )}

        {/* ─── 회원 탈퇴 ───
            자주 쓸 일이 없고 되돌릴 수 없는 기능이라 눈에 띄지 않게, 로그아웃 아래 작은 회색 글자로 둔다.
            숨기지는 않는다 — 심사 가이드 5.1.1(v)는 앱 안에서 찾을 수 있을 것을 요구한다.
            누르면 2단계 확인(무엇을 잃는지 → 되돌릴 수 없음)이 그대로 지킨다. */}
        {token && (
          <View style={styles.deleteWrap}>
            <Pressable
              onPress={() => {
                hapticWarning(); // 되돌릴 수 없는 행동 직전 — 확인창을 띄우는 순간 한 번 경고
                setDeleteStep(1);
              }}
              disabled={deleting}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="회원 탈퇴"
            >
              <ThemedText variant="caption" tone="placeholder" style={styles.deleteLink}>
                {deleting ? '탈퇴하는 중…' : '회원 탈퇴'}
              </ThemedText>
            </Pressable>
            {deleteError ? (
              <ThemedText variant="caption" style={{ color: theme.colors.ruby.base, marginTop: 6 }}>
                {deleteError}
              </ThemedText>
            ) : null}
          </View>
        )}

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
        onSave={handleSaveNickname}
        onClose={() => setNicknameSheetOpen(false)}
      />

      {/* 차단 목록 시트 — 항목을 누르면 그 사람의 차단이 풀린다(시스템 Alert X). */}
      <ActionSheet
        visible={blockedSheetOpen}
        title="누르면 차단이 풀려요"
        items={blocked.map((u) => ({
          label: `${u.nickname} 차단 해제`,
          onPress: () => void handleUnblock(u),
        }))}
        onClose={() => setBlockedSheetOpen(false)}
        cancelLabel="닫기"
      />

      {/* 버그 제보 시트 */}
      <BugReportSheet
        visible={bugSheetOpen}
        onSubmit={handleSendFeedback}
        onClose={() => setBugSheetOpen(false)}
      />

      {/* ─── 탈퇴 확인 (한 창, 두 단계) ───
          1단계: 무엇을 잃는지. 여기서는 아직 지우지 않는다. '다음'이라 적어 **이게 끝이 아님**을 알린다 —
            '탈퇴'라고 적으면 여기서 끝나는 줄 알고 누른다. 버튼 색은 "모두 사라져요"라는 말과 맞춘다.
          2단계: 되돌릴 수 없다는 것만. 1단계와 같은 말을 반복하면 두 번째가 요식이 되어 그냥 누른다.
            되돌아갈 길('아니요')을 둔다. 지우는 동안엔 창이 그대로 남아 "탈퇴 중…"을 보여준다. */}
      <ConfirmDialog
        visible={deleteStep > 0}
        keepOpen
        title={deleteStep === 2 ? '되돌릴 수 없어요' : '정말 탈퇴할까요?'}
        message={
          deleteStep === 2
            ? '지운 기록은 다시 찾을 수 없어요.\n그래도 탈퇴할까요?'
            : '기록한 정의가 모두 사라져요.\n이 폰에 저장된 것까지요.'
        }
        destructive
        cancelLabel={deleteStep === 2 ? '아니요' : '취소'}
        // 버튼 폭이 좁아 '탈퇴하기'는 '탈퇴…'로 잘렸다. 두 글자로 맞춘다.
        confirmLabel={deleteStep === 2 ? (deleting ? '탈퇴 중…' : '탈퇴') : '다음'}
        // 같은 자리 버튼이 '다음'→'탈퇴'로 바뀐다. 빠른 두 번 탭이 둘째 단계를 건너뛰지 않게,
        // 단계가 바뀐 뒤 0.6초 동안의 누름은 무시한다(되돌릴 수 없는 일이라 일부러 한 번 멈추게).
        onConfirm={
          deleteStep === 2
            ? () => {
                if (Date.now() - stepChangedAt.current < 600) return;
                void handleDeleteAccount();
              }
            : () => {
                stepChangedAt.current = Date.now();
                setDeleteStep(2);
              }
        }
        onClose={() => {
          if (!deleting) setDeleteStep(0); // 지우는 중엔 닫지 않는다 — 결과를 볼 자리가 사라진다
        }}
      />

      {/* 로그아웃 — 앱 안에서는 '기기'가 아니라 '폰'으로 쓴다.
          실패 단계의 취소 버튼은 "그래도 로그아웃"(onCancel). 바깥 탭은 그냥 닫기라 실수로 나가지 않는다. */}
      <ConfirmDialog
        visible={logoutStep !== 'closed'}
        keepOpen
        title={
          logoutStep === 'failed'
            ? `서버에 못 올린 기록 ${unsynced}개`
            : '로그아웃할까요?'
        }
        message={
          logoutStep === 'failed'
            ? `아직 서버에 올라가지 않은 기록 ${unsynced}개가 있어요. 이 폰에는 그대로 남지만, ` +
              '다른 계정으로 로그인하면 이 폰에서 지워져요.\n인터넷 연결을 확인하고 다시 시도해 주세요.'
            : logoutStep === 'syncing'
              ? '아직 안 올라간 기록을 서버에 올리고 있어요…'
              : '기록한 단어는 이 폰에 그대로 남아요.'
        }
        confirmLabel={
          logoutStep === 'syncing' ? '올리는 중…' : logoutStep === 'failed' ? '다시 시도' : '로그아웃'
        }
        cancelLabel={logoutStep === 'failed' ? '그래도 로그아웃' : '취소'}
        onConfirm={confirmLogout}
        onCancel={logoutStep === 'failed' ? handleLogout : undefined}
        onClose={() => {
          if (logoutStep !== 'syncing') setLogoutStep('closed');
        }}
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
        color: theme.colors.ink.secondary, // 누를 수 없는 제목 — 포인트는 누르는 것·선택된 것에만
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

/**
 * 팔레트 하나 — 그 팔레트의 p600(지금 모드 기준)으로 칠한 동그라미 + 이름.
 * 고른 것: 진한 잉크 테 + 체크 / 나머지: 옅은 헤어라인 테. 테는 스르륵 바뀐다.
 */
function PaletteSwatch({
  theme,
  id,
  selected,
  onPress,
}: {
  theme: Theme;
  id: PaletteId;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = getColors(id, theme.mode); // 그 팔레트의 색(지금 모드)
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(on, {
      toValue: selected ? 1 : 0,
      duration: theme.motion.duration.base,
      easing: theme.motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [selected, on, theme.motion]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={PALETTES[id].label}
      accessibilityState={{ selected, checked: selected }}
      style={styles.swatchCell}
    >
      <View style={[styles.swatchRing, { borderColor: theme.colors.line.strong }]}>
        {/* 고른 테는 헤어라인 위에 겹쳐 두고 투명도만 바꾼다(테 굵기를 애니메이션하면 동그라미가 출렁인다) */}
        <Animated.View
          style={[
            styles.swatchRing,
            styles.swatchRingOn,
            { borderColor: theme.colors.ink.primary, opacity: on },
          ]}
        />
        <View style={[styles.swatchDot, { backgroundColor: colors.point.p600 }]}>
          <Animated.View style={{ opacity: on }}>
            <Icon name="check" size={16} color={colors.ink.onPoint} />
          </Animated.View>
        </View>
      </View>
      <ThemedText
        variant="caption"
        numberOfLines={1}
        style={{
          marginTop: theme.spacing.s2,
          color: selected ? theme.colors.ink.primary : theme.colors.ink.secondary,
        }}
      >
        {PALETTES[id].label}
      </ThemedText>
    </Pressable>
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
  iconColor,
  label,
  value,
  valueColor,
  onPress,
  showChevron = true,
  disabled,
  toggle,
  sansLabel,
}: {
  theme: Theme;
  icon: IconName;
  /** 아이콘 색(기본 ink.secondary). 상태를 색으로 알릴 때만 넘긴다. */
  iconColor?: string;
  label: string;
  value?: string;
  /** 값 글자색 지정(기본은 placeholder 톤). 경고를 색으로 구분할 때만 넘긴다. */
  valueColor?: string;
  onPress?: () => void;
  /** >는 "눌러서 다음 화면으로 간다"는 뜻이다. 제자리에서 값만 바뀌는 토글 행에서는 끈다. */
  showChevron?: boolean;
  disabled?: boolean;
  /**
   * 켜고 끄는 행. 주면 값·셰브론 대신 스위치를 그린다.
   *
   * '켬'/'끔'이라는 **글자만** 있으면 눌러서 바뀐다는 걸 알 수 없다 — 바로 아래
   * 비활성 행('알림 설정 · 준비 중')과 생김새가 똑같았다. 스위치는 OS가 이미
   * 가르쳐 놓은 모양이라 설명이 필요 없다.
   */
  toggle?: boolean;
  /** 라벨을 산세리프로(이메일처럼 식별자를 보여줄 때). */
  sansLabel?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || !onPress}
      // 스위치는 그림일 뿐(pointerEvents none) — 누르는 주체는 행이다. 그래서 역할·상태도 행이 말한다.
      accessibilityRole={toggle !== undefined ? 'switch' : undefined}
      accessibilityState={toggle !== undefined ? { checked: toggle } : undefined}
      style={[styles.row, { backgroundColor: 'transparent' }, disabled && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={19} color={iconColor ?? theme.colors.ink.secondary} />
      <ThemedText
        variant={sansLabel ? 'label' : 'body'}
        tone="strong"
        // 라벨은 줄지 않는다(flexShrink 0) — 긴 값(닉네임 등)에 밀려 "닉네…"로 잘리던 문제. 줄어드는 쪽은 값.
        // 단, 식별자 라벨(이메일)은 그 자체가 길 수 있어 예외로 줄어들게 둔다.
        style={[styles.rowLabel, sansLabel && { fontWeight: '500', flexShrink: 1 }]}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          pointerEvents="none"
          // 꺼진 트랙은 placeholder 톤 — line.strong은 바탕과 너무 비슷해 '꺼짐'이 안 읽혔다.
          trackColor={{ false: theme.colors.ink.placeholder, true: theme.colors.point.p500 }}
          // 엄지는 흰색으로 고정 — 안 주면 플랫폼마다 제 색을 써서 톤이 깨진다.
          thumbColor="#FFFFFF"
          // RN Web은 켜짐 상태에서 thumbColor 대신 이 값(기본 청록)을 쓴다. RN 타입엔 없는 웹 전용 prop.
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          ios_backgroundColor={theme.colors.ink.placeholder}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <>
          {value ? (
            <ThemedText
              variant="sm"
              tone="placeholder"
              numberOfLines={1}
              style={[
                styles.rowValue,
                valueColor ? { color: valueColor, fontWeight: '700' } : null,
              ]}
            >
              {value}
            </ThemedText>
          ) : null}
          {onPress && showChevron ? (
            <Icon name="chevronR" size={16} color={theme.colors.ink.placeholder} />
          ) : null}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  deleteWrap: { alignItems: 'center', marginTop: 16 },
  // 밑줄 — 회색 글자만으론 누를 수 있는지 모른다. 링크라는 최소한의 단서.
  deleteLink: { textDecorationLine: 'underline' },
  rowLabel: { flexGrow: 1, flexShrink: 0, marginLeft: 12, marginRight: 8 },
  rowValue: { flexShrink: 1, maxWidth: '55%', marginRight: 6, textAlign: 'right' },
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

  // 6개가 한 줄 — 360pt 폰(본문 폭 312)에 50×6=300으로 들어간다. 더 좁으면 줄바꿈.
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  swatchCell: { width: 50, alignItems: 'center' },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
    // 바깥 테 안쪽 기준으로 놓이니 헤어라인만큼 당겨 같은 자리에 겹친다
  swatchRingOn: {
    position: 'absolute',
    top: -StyleSheet.hairlineWidth,
    left: -StyleSheet.hairlineWidth,
    borderWidth: 2,
  },
  swatchDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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

  logoutButton: {
    marginTop: 32,
  },
  footer: {
    alignItems: 'center',
    marginTop: 36,
  },
});
