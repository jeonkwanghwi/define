/**
 * 광장 (Plaza) 리스트 — 정의가 쌓인 단어들 + "이번 주" 통계.
 *
 * 각 단어 카드에 대표 정의 미리보기(추천순 상위 2)를 노출해 "같은 단어, 다른 정의"를
 * 리스트에서 바로 보이게 한다. 상단 통계는 오독 방지를 위해 분리:
 *   - 참여 요약 카드(이번 주 N명·M개 + 내 공감)
 *   - 주목 단어 타일 2개(가장 공감받은 / 가장 의견이 많은) — 별도 박스(가운데정렬), 클릭 시 상세.
 * 단어 목록은 활동순(백엔드). 가입 필요 탭 — AuthGate가 로그아웃 사용자에게 가입 유도.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { AuthGate } from '@/components/domain/auth-gate';
import { FadeIn, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import {
  getPlazaStats,
  getPlazaWords,
  type PlazaStats,
  type PlazaWord,
} from '@/services/plaza-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function PlazaScreen() {
  return (
    <AuthGate
      icon="plaza"
      title="광장"
      description="다른 사람들은 이 단어를 어떻게 정의했을까요? 가입하고 내 정의를 나누면 광장이 열려요."
    >
      <PlazaWordList />
    </AuthGate>
  );
}

function PlazaWordList() {
  const theme = useTheme();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [words, setWords] = useState<PlazaWord[] | null>(null);
  const [stats, setStats] = useState<PlazaStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setFailed(false);
    // 단어 목록은 필수(실패 시 에러 화면), 통계는 부가(실패해도 리스트는 보여줌).
    getPlazaWords(token)
      .then((w) => alive && setWords(w))
      .catch(() => alive && setFailed(true));
    getPlazaStats(token)
      .then((s) => alive && setStats(s))
      .catch(() => {
        /* 통계는 부가 정보 — 실패해도 무시 */
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const openWord = (word: string) =>
    router.push({ pathname: '/plaza/[word]', params: { word } });

  if (failed) return <CenterMessage text="광장을 불러오지 못했어요." />;
  if (words === null) return <CenterMessage text="불러오는 중…" />;

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppHeader />
        <ThemedText variant="h1">광장</ThemedText>
        <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
          남들은 이 단어를 어떻게 정의했을까요
        </ThemedText>

        {stats ? (
          <FadeIn>
            <StatsSection stats={stats} onWord={openWord} />
          </FadeIn>
        ) : null}

        {words.length === 0 ? (
          <ThemedText
            variant="body"
            tone="secondary"
            style={{ marginTop: theme.spacing.s8, textAlign: 'center' }}
          >
            아직 정의된 단어가 없어요.
          </ThemedText>
        ) : (
          <View style={[styles.list, { marginTop: theme.spacing.s6 }]}>
            {words.map((w, i) => (
              <FadeIn key={w.word} delay={Math.min(i, 8) * 40}>
                <WordCard word={w} onPress={() => openWord(w.word)} />
              </FadeIn>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

/** 상단 통계 — 참여 요약 카드 + 주목 단어 타일 2개(분리). */
function StatsSection({ stats, onWord }: { stats: PlazaStats; onWord: (w: string) => void }) {
  const theme = useTheme();
  const { topLikedWord, mostDefinedWord } = stats;
  const accent = { color: theme.colors.point.p600, fontWeight: '700' } as const;

  return (
    <View>
      {/* 참여 요약 카드 — 이번 주 활동. 단어 하이라이트와 섞이지 않게 분리. */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: theme.colors.surface.base,
            borderColor: theme.colors.line.base,
            borderRadius: theme.radii.lg,
          },
          theme.shadows.sm,
        ]}
      >
        <View style={styles.summaryHead}>
          <Icon name="sparkle" size={15} color={theme.colors.point.p600} />
          <ThemedText variant="caption" style={{ color: theme.colors.point.p600, letterSpacing: 1 }}>
            이번 주 광장
          </ThemedText>
        </View>

        <ThemedText variant="bodyMd" tone="strong" style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}>
          <ThemedText variant="bodyMd" style={accent}>
            {stats.weekContributors}명
          </ThemedText>
          {'이 '}
          <ThemedText variant="bodyMd" style={accent}>
            {stats.weekDefinitions}개
          </ThemedText>
          {'의 정의를 남겼어요'}
        </ThemedText>

        <View style={styles.myLike}>
          <Icon name="heart" size={13} color={theme.colors.ink.placeholder} />
          <ThemedText variant="caption" tone="secondary">
            내 정의가 이번 주 받은 공감 {stats.myWeekLikesReceived}
          </ThemedText>
        </View>
      </View>

      {/* 주목 단어 — 각각 별도 타일(클릭 시 상세). */}
      {topLikedWord || mostDefinedWord ? (
        <View style={styles.tileRow}>
          {topLikedWord ? (
            <StatTile
              label="가장 공감받은"
              word={topLikedWord.word}
              icon="heart"
              metric={String(topLikedWord.likeCount)}
              onPress={() => onWord(topLikedWord.word)}
            />
          ) : null}
          {mostDefinedWord ? (
            <StatTile
              label="가장 의견이 많은"
              word={mostDefinedWord.word}
              icon="shuffle"
              metric={`${mostDefinedWord.count}개`}
              onPress={() => onWord(mostDefinedWord.word)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** 주목 단어 타일 — 라벨 / 단어(강조) / 지표. 채워진 point 톤으로 하이라이트. */
function StatTile({
  label,
  word,
  icon,
  metric,
  onPress,
}: {
  label: string;
  word: string;
  icon: IconName;
  metric: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.point.p050,
          borderColor: theme.colors.point.p100,
          borderRadius: theme.radii.md,
        },
      ]}
    >
      <ThemedText variant="caption" style={{ color: theme.colors.point.p600 }}>
        {label}
      </ThemedText>
      <ThemedText
        variant="h3"
        numberOfLines={1}
        style={{ color: theme.colors.point.p700, marginTop: 4 }}
      >
        {word}
      </ThemedText>
      <View style={styles.tileMetric}>
        <Icon name={icon} size={13} color={theme.colors.point.p600} />
        <ThemedText variant="caption" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
          {metric}
        </ThemedText>
      </View>
    </PressableScale>
  );
}

/** 단어 카드 — 단어 + 정의 수 + 대표 정의 미리보기(최대 2). */
function WordCard({ word, onPress }: { word: PlazaWord; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
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
        <ThemedText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
          {word.word}
        </ThemedText>
        <ThemedText variant="caption" tone="placeholder">
          {word.count}개의 정의
        </ThemedText>
      </View>

      {word.previews.map((p) => (
        <View key={p.id} style={{ marginTop: theme.spacing.s3 }}>
          <ThemedText variant="body" tone="strong" numberOfLines={2} style={{ lineHeight: 24 }}>
            “{p.text}”
          </ThemedText>
          <View style={styles.previewMeta}>
            <ThemedText variant="caption" tone="secondary">
              {p.nickname}
            </ThemedText>
            <Icon name="heart" size={11} color={theme.colors.ink.placeholder} />
            <ThemedText variant="caption" tone="placeholder">
              {p.likeCount}
            </ThemedText>
          </View>
        </View>
      ))}
    </PressableScale>
  );
}

function CenterMessage({ text }: { text: string }) {
  return (
    <ThemedView bg="paper" style={styles.center}>
      <ThemedText variant="body" tone="secondary">
        {text}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  list: { gap: 12 },

  summaryCard: { marginTop: 24, borderWidth: 1, padding: 16, alignItems: 'center' },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  myLike: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },

  tileRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tile: { flex: 1, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  tileMetric: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },

  card: { borderWidth: 1, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
});
