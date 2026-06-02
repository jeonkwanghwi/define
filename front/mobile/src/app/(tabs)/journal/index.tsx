/**
 * 단어장 (Journal) — 사용자가 영속 store에 적은 단어 리스트.
 *
 * 화면 구성:
 *   1. 헤더    — "나만의 단어장" + "{N}개 단어" 카운트 칩
 *   2. stat 2 — 총 기록 / 생각 변화 (연속 기록은 추후 streak 로직 도입 시)
 *   3. 리스트  — 가나다순. 누르면 /journal/{word} 동적 라우트로 push.
 *
 * 데이터는 src/store/journal-store.ts (Zustand + AsyncStorage persist).
 * mock 없이 사용자가 기록한 것만 표시. 비어있으면 빈 상태 안내.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { WordRow } from '@/components/domain/word-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { useGroupedByWord, useJournalStats } from '@/store/journal-store';
import { useTheme } from '@/theme';

export default function JournalListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const grouped = useGroupedByWord();
  const stats = useJournalStats();

  // 가나다 정렬 — 그룹은 store insert 순이라 디스플레이 시점에 정렬
  const sorted = useMemo(
    () => [...grouped].sort((a, b) => a.word.localeCompare(b.word, 'ko')),
    [grouped],
  );

  function openWord(word: string) {
    router.push({ pathname: '/journal/[word]', params: { word } });
  }

  // ─── 빈 상태 ───
  if (sorted.length === 0) {
    return (
      <ThemedView bg="paper" style={styles.root}>
        <View style={styles.emptyWrap}>
          <Icon name="book" size={56} color={theme.colors.point.p300} />
          <ThemedText variant="h3" style={{ marginTop: theme.spacing.s4 }}>
            아직 기록한 단어가 없어요
          </ThemedText>
          <ThemedText
            variant="body"
            tone="secondary"
            style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}
          >
            가운데 ‘기록’ 탭에서{'\n'}오늘의 단어를 정의해보세요
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. 헤더 ─── */}
        <View style={styles.headerRow}>
          <ThemedText variant="h1">나만의 단어장</ThemedText>
          <View
            style={[
              styles.countPill,
              {
                backgroundColor: theme.colors.surface.nested,
                borderColor: theme.colors.line.base,
              },
            ]}
          >
            <ThemedText variant="caption" tone="secondary">
              {stats.uniqueWords}개 단어
            </ThemedText>
          </View>
        </View>

        {/* ─── 2. 통계 ─── */}
        <View style={[styles.statStrip, { marginTop: theme.spacing.s4 }]}>
          <StatCard label="총 기록" value={`${stats.totalEntries}`} />
          <StatCard label="생각 변화" value={`${stats.changedWords}`} />
        </View>

        {/* ─── 3. 단어 리스트 ─── */}
        <View style={[styles.list, { marginTop: theme.spacing.s6 }]}>
          {sorted.map((w) => (
            <WordRow key={w.word} item={w} onPress={() => openWord(w.word)} />
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// 통계 한 칸 — 이 화면에서만 쓰는 작은 헬퍼라 인라인.
function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        statStyles.card,
        {
          backgroundColor: theme.colors.surface.base,
          borderColor: theme.colors.line.base,
        },
        theme.shadows.sm,
      ]}
    >
      <ThemedText
        style={{
          fontFamily: 'PretendardVariable',
          fontWeight: '800',
          fontSize: 22,
          color: theme.colors.point.p600,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </ThemedText>
      <ThemedText
        variant="caption"
        tone="secondary"
        style={{ marginTop: 4 }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  statStrip: {
    flexDirection: 'row',
    gap: 10,
  },
  list: {
    gap: 10,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
});
