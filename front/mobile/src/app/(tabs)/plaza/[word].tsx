/**
 * 광장 단어 상세 — 한 단어에 대한 여러 사람의 정의 카드.
 *
 * 동적 라우트: /plaza/{word}. useLocalSearchParams로 word 받음(journal [word] 패턴).
 * 서버에서 정의 목록을 받아 표시. 내 정의(isMine)는 맨 위 + 포인트 강조 + "내 정의" 배지.
 *
 * 비로그인 처리: 이 화면은 광장 리스트(AuthGate 적용)에서만 들어오지만, 딥링크·웹 새로고침으로
 * 바로 열릴 수 있다. 그때 토큰이 없으면 요청을 못 보내 "불러오는 중…"에 갇히므로
 * 가입 유도 화면을 대신 보여준다. AuthGate를 쓰지 않는 이유 = push된 화면이라
 * 뒤로가기 헤더를 잃으면 빠져나갈 길이 없어진다(AuthGate는 탭 루트용).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { LikeButton } from '@/components/domain/like-button';
import { ScreenHeader } from '@/components/domain/screen-header';
import { Button, FadeIn, Loading } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { formatRelativeLabel } from '@/lib/format-date';
import { hapticTap } from '@/lib/haptics';
import { getPlazaWord, toggleEntryLike, type PlazaWordDetail } from '@/services/plaza-api';
import { useAuthHydrated, useAuthStore } from '@/store/auth-store';
import { controlPresets, useTheme } from '@/theme';

export default function PlazaWordDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { word: rawWord } = useLocalSearchParams<{ word: string }>();
  const word = typeof rawWord === 'string' ? rawWord : '';
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthHydrated();

  const [data, setData] = useState<PlazaWordDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /** 당겨서 새로고침 — 남이 방금 쓴 정의·좋아요를 보려면 다시 받을 수단이 있어야 한다. */
  const onRefresh = useCallback(async () => {
    if (!token || !word) return;
    setRefreshing(true);
    try {
      setData(await getPlazaWord(token, word));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [token, word]);

  useEffect(() => {
    if (!token || !word) return;
    let alive = true;
    setFailed(false);
    getPlazaWord(token, word)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [token, word]);

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
        // 실패 시 optimistic 되돌림(조용히)
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
      });
  }

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
            “{word}”을 사람들이 어떻게 정의했는지 보려면 가입해 주세요.
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.point.p500}
          />
        }
      >
        {failed ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            정의를 불러오지 못했어요.
          </ThemedText>
        ) : data === null ? (
          <View style={styles.loadingWrap}>
            <Loading message="정의를 불러오고 있어요" />
          </View>
        ) : data.definitions.length === 0 ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            아직 정의가 없어요.
          </ThemedText>
        ) : (
          data.definitions.map((d, i) => (
            <FadeIn key={d.id} delay={Math.min(i, 8) * 40}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface.base,
                    borderColor: d.isMine ? theme.colors.point.p500 : theme.colors.line.base,
                    borderRadius: theme.radii.lg,
                  },
                  theme.shadows.sm,
                ]}
              >
                <View style={styles.cardHead}>
                  <ThemedText variant="bodyMd" tone="strong">
                    {d.nickname}
                  </ThemedText>
                  {d.isMine ? (
                    <View style={[styles.badge, { backgroundColor: theme.colors.point.p100 }]}>
                      <ThemedText variant="caption" style={{ color: theme.colors.point.p700 }}>
                        내 정의
                      </ThemedText>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <ThemedText variant="caption" tone="placeholder">
                    {formatRelativeLabel(new Date(d.savedAt), new Date())}
                  </ThemedText>
                </View>
                <ThemedText variant="body" style={{ marginTop: theme.spacing.s2 }}>
                  {d.text}
                </ThemedText>
                {!d.isMine ? (
                  <LikeButton
                    liked={d.isLiked}
                    count={d.likeCount}
                    onToggle={() => handleToggleLike(d.id)}
                  />
                ) : null}
              </View>
            </FadeIn>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 12 },
  centerText: { textAlign: 'center', marginTop: 80 },
  // ScrollView 안이라 flex:1이 안 먹는다 → 높이를 줘 Loading이 중앙에 오게.
  loadingWrap: { height: 200, justifyContent: 'center' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: { borderWidth: 1, paddingVertical: 16, paddingHorizontal: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { ...controlPresets.badge, borderRadius: 999 },
});
