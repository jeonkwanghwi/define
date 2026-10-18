/**
 * 광장 단어 상세 — 한 단어에 대한 여러 사람의 정의 카드.
 *
 * 동적 라우트: /plaza/{word}. useLocalSearchParams로 word 받음(journal [word] 패턴).
 * 서버에서 정의 목록을 받아 표시. 내 정의(isMine)는 최신 하나만 맨 위 + 포인트 강조 + "내 정의" 배지
 * (이전 것들은 "내 이전 정의 N개 보기" → 단어장 타임라인).
 *
 * 무한 스크롤: 서버가 10개씩 준다(좋아요 많은 순). 바닥 근처에 오면 다음 쪽을 붙인다.
 * 정의가 수백 개로 늘어도 처음엔 10개만 받고, FlatList가 화면 밖 카드는 그리지 않아 가볍다.
 *
 * 비로그인 처리: 이 화면은 광장 리스트(AuthGate 적용)에서만 들어오지만, 딥링크·웹 새로고침으로
 * 바로 열릴 수 있다. 그때 토큰이 없으면 요청을 못 보내 "불러오는 중…"에 갇히므로
 * 가입 유도 화면을 대신 보여준다. AuthGate를 쓰지 않는 이유 = push된 화면이라
 * 뒤로가기 헤더를 잃으면 빠져나갈 길이 없어진다(AuthGate는 탭 루트용).
 *
 * 중재(신고·차단, Apple 심사 가이드 1.2): 남의 카드마다 ⋯ 메뉴를 둔다.
 * 내 글에는 보이지 않는다 — 자기 글을 신고·차단할 일은 없다(서버도 400으로 막는다).
 * 숨김·차단 필터는 서버가 걸러 내려주므로 앱은 조회 결과를 그대로 믿는다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { LikeButton } from '@/components/domain/like-button';
import { LoadFailed } from '@/components/domain/load-failed';
import { ReportSheet } from '@/components/domain/report-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
import {
  ActionSheet,
  Button,
  ConfirmDialog,
  FadeIn,
  Loading,
  PressableScale,
  useToast,
} from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { formatRelativeLabel } from '@/lib/format-date';
import { hapticError, hapticSuccess, hapticTap } from '@/lib/haptics';
import { objectSuffix } from '@/lib/korean';
import {
  blockUser,
  getPlazaWord,
  reportEntry,
  toggleEntryLike,
  type PlazaDefinition,
  type PlazaWordDetail,
  type ReportReason,
} from '@/services/plaza-api';
import { useAuthHydrated, useAuthStore } from '@/store/auth-store';
import { useJournalWord } from '@/store/journal-store';
import { controlPresets, useTheme } from '@/theme';

export default function PlazaWordDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { word: rawWord } = useLocalSearchParams<{ word: string }>();
  const word = typeof rawWord === 'string' ? rawWord : '';
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthHydrated();
  const localWord = useJournalWord(word);

  const { show } = useToast();

  const [data, setData] = useState<PlazaWordDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // 다음 쪽의 offset = 서버에서 받은 남의 정의 수. 화면 개수(data.definitions.length)로 쓰면 안 된다 —
  // 신고·차단으로 카드를 걷어내면 줄어들어, 다음 쪽이 이미 본 카드를 다시 준다.
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  /** 첫 쪽을 받아 화면을 통째로 바꾼다(첫 진입·당겨서 새로고침 공용). */
  const applyFirstPage = useCallback((d: PlazaWordDetail) => {
    setData(d);
    setNextOffset(d.definitions.filter((x) => !x.isMine).length);
    setMoreFailed(false);
  }, []);

  // 중재 흐름의 대상 카드. 셋을 따로 두는 이유 = ⋯ 메뉴 → 사유 시트 / 차단 확인으로
  // 갈라지고, 시트가 닫히는 동안에도 대상이 살아 있어야 한다.
  const [menuTarget, setMenuTarget] = useState<PlazaDefinition | null>(null);
  const [reportTarget, setReportTarget] = useState<PlazaDefinition | null>(null);
  const [blockTarget, setBlockTarget] = useState<PlazaDefinition | null>(null);
  // 전송 중인 카드 = 진행 중 표시. ActionSheet·ConfirmDialog는 누른 직후 닫혀서
  // 그 안에 "보내는 중"을 그릴 자리가 없다 → 그 카드의 ⋯만 잠가 두 번 보내는 걸 막는다.
  const [busyId, setBusyId] = useState<string | null>(null);
  // 시트 제목에 쓸 닉네임. 대상(menuTarget 등)은 시트가 닫히는 순간 null이 돼, 그걸 쓰면
  // 내려가는 동안 제목이 바뀌어 보인다 → 열 때 한 번 적어 두고 지우지 않는다.
  const [sheetNickname, setSheetNickname] = useState('');

  /** 당겨서 새로고침 — 남이 방금 쓴 정의·좋아요를 보려면 다시 받을 수단이 있어야 한다. */
  const onRefresh = useCallback(async () => {
    if (!token || !word) return;
    setRefreshing(true);
    try {
      applyFirstPage(await getPlazaWord(token, word));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [token, word, applyFirstPage]);

  /**
   * 다음 쪽. 바닥 근처에서 여러 번 불려도 한 번만 나간다(loadingMore).
   * 실패하면 자동으로 다시 부르지 않는다 — 스크롤할 때마다 실패 요청이 쏟아진다.
   * 대신 바닥에 "다시 시도"를 띄운다(실패를 삼키면 "정의가 여기까지"로 읽힌다).
   */
  const fetchMore = useCallback(async () => {
    if (!token || !data?.hasMore || loadingMore) return;
    setMoreFailed(false);
    setLoadingMore(true);
    try {
      const page = await getPlazaWord(token, word, nextOffset);
      setNextOffset((n) => n + page.definitions.length);
      setData((prev) => {
        if (!prev) return prev;
        // 쪽을 넘기는 사이 좋아요 순위가 바뀌면 한 장이 겹칠 수 있다 → id로 거른다.
        const seen = new Set(prev.definitions.map((d) => d.id));
        return {
          ...prev,
          definitions: [...prev.definitions, ...page.definitions.filter((d) => !seen.has(d.id))],
          hasMore: page.hasMore,
        };
      });
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }, [token, word, data?.hasMore, loadingMore, nextOffset]);

  /** 스크롤로 부를 때는 실패 상태면 멈춘다. 다시 시도 버튼은 fetchMore를 바로 부른다. */
  const loadMore = useCallback(() => {
    if (!moreFailed) void fetchMore();
  }, [moreFailed, fetchMore]);

  useEffect(() => {
    if (!token || !word) return;
    let alive = true;
    setFailed(false);
    getPlazaWord(token, word)
      .then((d) => {
        if (alive) applyFirstPage(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [token, word, applyFirstPage]);

  function handleToggleLike(entryId: string) {
    if (!token) return;
    // 서버 응답을 기다리지 않고 지금 울린다 — 낙관적 반영과 손끝의 신호가 어긋나면 안 된다.
    hapticTap();
    // optimistic: 즉시 반영(정렬은 재정렬 안 함 — 손가락 밑에서 카드가 튀지 않게)
    setData((prev) =>
      prev
        ? {
            ...prev,
            definitions: prev.definitions.map((d) =>
              d.id === entryId
                ? { ...d, isLiked: !d.isLiked, likeCount: d.likeCount + (d.isLiked ? -1 : 1) }
                : d,
            ),
          }
        : prev,
    );
    toggleEntryLike(token, entryId)
      .then((res) => {
        // 서버 값으로 확정
        setData((prev) =>
          prev
            ? {
                ...prev,
                definitions: prev.definitions.map((d) =>
                  d.id === entryId ? { ...d, isLiked: res.liked, likeCount: res.likeCount } : d,
                ),
              }
            : prev,
        );
      })
      .catch(() => {
        // optimistic 되돌림. 하트가 켜졌다 꺼지는 것만 보이면 사용자는 앱이 고장났다고 읽는다
        // — 되돌린 이유를 같이 말해준다.
        setData((prev) =>
          prev
            ? {
                ...prev,
                definitions: prev.definitions.map((d) =>
                  d.id === entryId
                    ? { ...d, isLiked: !d.isLiked, likeCount: d.likeCount + (d.isLiked ? -1 : 1) }
                    : d,
                ),
              }
            : prev,
        );
        hapticError();
        show('공감을 저장하지 못했어요', { tone: 'error' });
      });
  }

  /** 목록에서 카드를 걷어낸다. 서버가 이미 반영한 걸 화면에 맞추는 것뿐 — 다시 받지 않는다. */
  function dropDefinitions(keep: (d: PlazaDefinition) => boolean) {
    setData((prev) => (prev ? { ...prev, definitions: prev.definitions.filter(keep) } : prev));
  }

  /**
   * 신고 — 사유를 고른 순간 전송한다.
   * 성공: 토스트 + 그 카드를 즉시 감춘다(신고한 사람에게 다시 보일 이유가 없다).
   * 실패: 토스트만. **카드는 그대로 둔다** — 사라지면 신고된 줄 안다.
   *   실패를 인라인이 아니라 토스트로 말하는 이유 = 사유 시트가 이미 닫혀 자리가 없다.
   */
  async function handleReport(target: PlazaDefinition, reason: ReportReason) {
    if (!token || busyId !== null) return;
    setBusyId(target.id);
    try {
      await reportEntry(token, target.id, reason);
      hapticSuccess();
      show('신고했어요. 검토 후 조치할게요');
      dropDefinitions((d) => d.id !== target.id);
    } catch {
      hapticError();
      show('신고하지 못했어요. 잠시 후 다시 시도해 주세요', { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  /** 차단 — 성공하면 그 사람 카드를 전부 치운다. 실패 시 아무것도 치우지 않는다. */
  async function handleBlock(target: PlazaDefinition) {
    if (!token || busyId !== null) return;
    setBusyId(target.id);
    try {
      await blockUser(token, target.authorId);
      hapticSuccess();
      show('차단했어요');
      dropDefinitions((d) => d.authorId !== target.authorId);
    } catch {
      hapticError();
      show('차단하지 못했어요. 잠시 후 다시 시도해 주세요', { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  /**
   * 내 정의는 **가장 최근 하나만** 맨 위에. 내가 5번 정의했으면 첫 화면이 내 기록으로 덮여
   * 정작 남의 정의(이 화면의 목적)가 안 보였다. 이전 것들은 단어장 타임라인으로 보낸다.
   * 페이징(nextOffset)은 원본 data.definitions 기준 그대로 — 여기선 보여줄 것만 고른다.
   */
  const defs = data?.definitions ?? [];
  const mine = defs.filter((d) => d.isMine);
  const latestMine = mine.reduce<PlazaDefinition | null>(
    (a, d) => (a === null || d.savedAt > a.savedAt ? d : a),
    null,
  );
  const others = defs.filter((d) => !d.isMine);
  const shown = latestMine ? [latestMine, ...others] : others;
  // 서버엔 있어도 이 폰 단어장엔 없을 수 있다(다른 기기·로컬 삭제). 그때 링크를 열면 빈 화면이
  // 바로 뒤로 튕겨 고장처럼 보인다 → 이 폰에 있을 때만 입구를 연다.
  const hasLocalWord = !!localWord;
  const openMyTimeline = () => router.push({ pathname: '/journal/[word]', params: { word } });

  // 비로그인 — 서버를 부를 수 없으니 로딩에 갇히지 않게 가입 유도로 대체(뒤로가기는 유지).
  // hydrated 전에는 판단하지 않는다(저장된 토큰을 아직 못 읽은 것뿐인데 가입 화면이 깜빡인다).
  if (hydrated && !token) {
    return (
      <ThemedView bg="paper" style={styles.root}>
        <ScreenHeader title={word} />
        <View style={styles.gate}>
          <Icon name="plaza" size={48} color={theme.colors.point.p600} />
          <ThemedText variant="h3" style={{ marginTop: theme.spacing.s4 }}>
            광장은 가입한 분들에게 열려요
          </ThemedText>
          <ThemedText
            variant="body"
            tone="secondary"
            style={{ marginTop: theme.spacing.s2, textAlign: 'center', lineHeight: 24 }}
          >
            “{word}”{objectSuffix(word)} 사람들이 어떻게 정의했는지 보려면 가입해 주세요.
          </ThemedText>
          <Button
            label="가입하고 시작하기"
            onPress={() => router.push('/auth')}
            style={{ marginTop: theme.spacing.s5 }}
          />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title={word} />

      <FlatList
        data={failed || data === null ? [] : shown}
        keyExtractor={(d) => d.id}
        // 실패 화면을 광장 목록과 같은 자리(가운데)에 두려면 빈 리스트도 화면 높이를 채워야 한다.
        contentContainerStyle={[styles.scroll, failed && styles.fill]}
        showsVerticalScrollIndicator={false}
        // 바닥에서 화면 반 높이쯤 남았을 때 미리 부른다 — 끝에 닿아서야 부르면 매번 멈칫한다.
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.point.p500}
          />
        }
        ListEmptyComponent={
          failed ? (
            // 광장 목록과 같은 실패 화면 — 같은 실패는 같은 모양이어야 한다.
            <View style={styles.failWrap}>
              <LoadFailed onRetry={onRefresh} retrying={refreshing} />
            </View>
          ) : data === null ? (
            <View style={styles.loadingWrap}>
              <Loading message="정의를 불러오고 있어요" />
            </View>
          ) : (
            <ThemedText variant="body" tone="secondary" style={styles.centerText}>
              아직 정의가 없어요.
            </ThemedText>
          )
        }
        ListFooterComponent={
          moreFailed ? (
            <View style={styles.moreWrap}>
              <ThemedText variant="sm" tone="secondary">
                더 불러오지 못했어요.
              </ThemedText>
              <Button
                label="다시 시도"
                variant="soft"
                size="sm"
                onPress={() => void fetchMore()}
              />
            </View>
          ) : loadingMore ? (
            <View style={styles.moreWrap}>
              <Loading inline />
            </View>
          ) : latestMine && others.length === 0 && !data?.hasMore ? (
            // 내 카드 하나뿐인 화면이 "남의 정의를 못 불러왔나?"로 읽히지 않게.
            <ThemedText variant="caption" tone="placeholder" style={styles.aloneText}>
              아직 나만 정의한 단어예요
            </ThemedText>
          ) : null
        }
        renderItem={({ item: d, index: i }) => (
          <FadeIn delay={i < 8 ? i * 40 : 0}>
            {d.isMine ? (
              <>
                {/* 내 카드 = 내 단어장 타임라인으로 가는 입구. 공감은 내가 누를 게 아니라 받은 수만 보인다. */}
                <PressableScale
                  onPress={hasLocalWord ? openMyTimeline : undefined}
                  disabled={!hasLocalWord}
                  accessibilityRole="button"
                  accessibilityLabel={`내 정의, 공감 ${d.likeCount} — 내 단어장에서 보기`}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.colors.surface.base,
                      borderColor: theme.colors.point.p500,
                      borderRadius: theme.radii.lg,
                    },
                    theme.shadows.sm,
                  ]}
                >
                  <View style={styles.cardHead}>
                    <ThemedText variant="bodyMd" tone="strong">
                      {d.nickname}
                    </ThemedText>
                    <View style={[styles.badge, { backgroundColor: theme.colors.point.p100 }]}>
                      <ThemedText variant="caption" style={{ color: theme.colors.point.p700 }}>
                        내 정의
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1 }} />
                    <ThemedText variant="caption" tone="placeholder">
                      {formatRelativeLabel(new Date(d.savedAt), new Date())}
                    </ThemedText>
                    {hasLocalWord ? <Icon name="chevronR" size={16} color={theme.colors.ink.placeholder} /> : null}
                  </View>
                  <ThemedText variant="body" style={{ marginTop: theme.spacing.s2 }}>
                    {d.text}
                  </ThemedText>
                  {/* 읽기 전용 공감 수 — LikeButton과 같은 알약 치수·하트지만 테두리 대신 옅은 바탕:
                      누르는 버튼이 아니라 받은 숫자라는 걸 모양으로 구분한다. */}
                  <View style={[styles.likeStat, { backgroundColor: theme.colors.surface.nested }]}>
                    <Icon name="heart" size={16} color={theme.colors.ink.secondary} />
                    <ThemedText variant="caption" tone="secondary">
                      {d.likeCount}
                    </ThemedText>
                  </View>
                </PressableScale>
                {mine.length > 1 && hasLocalWord ? (
                  <Button
                    label={`내 이전 정의 ${mine.length - 1}개 보기`}
                    variant="ghost"
                    size="sm"
                    onPress={openMyTimeline}
                    style={styles.prevLink}
                  />
                ) : null}
              </>
            ) : (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface.base,
                    borderColor: theme.colors.line.base,
                    borderRadius: theme.radii.lg,
                  },
                  theme.shadows.sm,
                ]}
              >
                <View style={styles.cardHead}>
                  <ThemedText variant="bodyMd" tone="strong">
                    {d.nickname}
                  </ThemedText>
                  <View style={{ flex: 1 }} />
                  <ThemedText variant="caption" tone="placeholder">
                    {formatRelativeLabel(new Date(d.savedAt), new Date())}
                  </ThemedText>
                  {/* 남의 글에만 ⋯. 내 글엔 신고·차단할 대상이 없다. */}
                  <PressableScale
                    onPress={() => {
                      setSheetNickname(d.nickname);
                      setMenuTarget(d);
                    }}
                    disabled={busyId !== null}
                    // 아이콘이 18px이라 hitSlop 8로는 터치 영역이 34pt — Apple HIG 44pt 미달이었다.
                    // 신고·차단으로 가는 유일한 길이라 더 못 누르면 안 된다.
                    hitSlop={13}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.nickname}의 정의 — 신고하거나 차단하기`}
                    style={styles.menuBtn}
                  >
                    <Icon
                      name="more"
                      size={18}
                      color={
                        busyId === d.id
                          ? theme.colors.ink.placeholder
                          : theme.colors.ink.secondary
                      }
                    />
                  </PressableScale>
                </View>
                <ThemedText variant="body" style={{ marginTop: theme.spacing.s2 }}>
                  {d.text}
                </ThemedText>
                <LikeButton
                  liked={d.isLiked}
                  count={d.likeCount}
                  onToggle={() => handleToggleLike(d.id)}
                />
              </View>
            )}
          </FadeIn>
        )}
      />

      {/* ⋯ 메뉴 — 시스템 ActionSheet/Alert가 아니라 우리 톤의 시트를 쓴다. */}
      <ActionSheet
        visible={menuTarget !== null}
        // 어느 카드의 메뉴인지 — 시트가 카드를 가리면 누구 글인지 잊는다.
        title={`${sheetNickname}님의 정의`}
        items={[
          {
            label: '신고하기',
            onPress: () => setReportTarget(menuTarget),
          },
          {
            label: '이 사용자 차단하기',
            destructive: true,
            onPress: () => setBlockTarget(menuTarget),
          },
        ]}
        onClose={() => setMenuTarget(null)}
      />

      <ReportSheet
        visible={reportTarget !== null}
        nickname={sheetNickname}
        onSelect={(reason) => {
          if (reportTarget) void handleReport(reportTarget, reason);
        }}
        onClose={() => setReportTarget(null)}
      />

      <ConfirmDialog
        visible={blockTarget !== null}
        title="이 사용자를 차단할까요?"
        message={
          '이 사람의 정의가 안 보여요.\n상대는 알 수 없어요.'
        }
        confirmLabel="차단"
        destructive
        onConfirm={() => {
          if (blockTarget) void handleBlock(blockTarget);
        }}
        onClose={() => setBlockTarget(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 12 },
  centerText: { textAlign: 'center', marginTop: 80 },
  fill: { flexGrow: 1 },
  failWrap: { flex: 1, justifyContent: 'center' },
  aloneText: { textAlign: 'center', paddingVertical: 16 },
  prevLink: { alignSelf: 'center', marginTop: 4 },
  // 리스트 안이라 flex:1이 안 먹는다 → 높이를 줘 Loading이 중앙에 오게.
  loadingWrap: { height: 200, justifyContent: 'center' },
  moreWrap: { paddingVertical: 16, alignItems: 'center', gap: 12 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: { borderWidth: 1, paddingVertical: 16, paddingHorizontal: 16 },
  // 시간 글자 오른쪽. 음수 마진으로 카드 패딩 안쪽 여백을 되찾아 ⋯가 모서리에 붙는다.
  menuBtn: { paddingHorizontal: 4, marginRight: -4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { ...controlPresets.badge, borderRadius: 999 },
  // LikeButton의 알약과 같은 치수·자리(오른쪽 아래) — 숫자 위치가 남의 카드와 맞는다.
  likeStat: {
    marginTop: 12,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...controlPresets.pill,
    borderRadius: 999,
  },
});
