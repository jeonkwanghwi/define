/**
 * 단어장 (Journal) — 사용자가 영속 store에 적은 단어 리스트.
 *
 * 화면 구성:
 *   1. 헤더    — "나만의 단어장" + "{N}개 단어" 카운트 칩
 *   2. stat 3 — 총 기록 / 연속 기록 / 생각 변화
 *   3. 검색    — "단어 찾기". 한 글자 칠 때마다 거른다(초성·조합 중 글자 포함, lib/korean.matchWord).
 *   4. 리스트  — 최신순(마지막 정의 날짜). 누르면 /journal/{word} 동적 라우트로 push.
 *               단어가 수천 개여도 가볍게 FlatList(화면에 보이는 행만 그림).
 *
 * 데이터는 src/store/journal-store.ts (Zustand + AsyncStorage persist).
 * mock 없이 사용자가 기록한 것만 표시. 비어있으면 빈 상태 안내.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { WordRow } from '@/components/domain/word-row';
import { Button, FadeIn, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { matchWord, type MatchRange } from '@/lib/korean';
import { useGroupedByWord, useJournalStats, useJournalStreak } from '@/store/journal-store';
import { useTheme } from '@/theme';
import type { JournalWord } from '@/types/word';

/**
 * PDF 내보내기 자리를 가린다 (2026-10-12).
 *
 * Apple 심사 가이드 2.1이 "placeholder text … incomplete features"를 리젝 사유로 든다.
 * 점선 박스에 "준비 중"을 달아 자리만 잡아둔 건 **미완성 신호가 가장 뚜렷한 형태**다.
 * 지우지 않고 가린다 — IAP가 붙으면 이 상수만 true로 바꾸고 Pressable로 만들면 된다.
 * (DEVELOPMENT.md "다음 후보 — 마이페이지 후속")
 */
const SHOW_PDF_EXPORT = false;

export default function JournalListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const grouped = useGroupedByWord();
  const stats = useJournalStats();
  const streak = useJournalStreak();

  // 최신순 — 각 단어의 가장 최근 정의 날짜(entries[0].date) 내림차순.
  // date는 'YYYY.MM.DD' 0-패딩이라 문자열 비교=시간순. 같은 날짜면 가나다로 안정 정렬.
  const sorted = useMemo(
    () =>
      [...grouped].sort((a, b) => {
        const da = a.entries[0]?.date ?? '';
        const db = b.entries[0]?.date ?? '';
        return db !== da ? db.localeCompare(da) : a.word.localeCompare(b.word, 'ko');
      }),
    [grouped],
  );

  // 검색어 — 비면 전체. 키 하나마다 O(n) 한 바퀴라 수천 개도 충분히 가볍다.
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    const out: { item: JournalWord; range: MatchRange }[] = [];
    for (const item of sorted) {
      const range = matchWord(item.word, query);
      if (range) out.push({ item, range });
    }
    return out;
  }, [sorted, query]);

  function openWord(word: string) {
    router.push({ pathname: '/journal/[word]', params: { word } });
  }

  // ─── 빈 상태 ───
  if (sorted.length === 0) {
    return (
      <ThemedView bg="paper" style={styles.root}>
        <View style={styles.headerWrap}>
          <AppHeader />
        </View>
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
          {/* 글로만 "탭을 누르세요"라고 하면 빈 화면이 막다른 길이다 — 여기서 바로 가게 한다. */}
          <Button
            label="단어 정의하기"
            variant="soft"
            onPress={() => router.replace('/')}
            style={{ marginTop: theme.spacing.s6 }}
          />
        </View>
      </ThemedView>
    );
  }

  // FlatList 머리말. 컴포넌트 "타입"이 아니라 JSX "값"으로 넘긴다 —
  // 렌더마다 새 함수 컴포넌트를 만들면 React가 통째로 다시 마운트해서 입력창 포커스(키보드)가 날아간다.
  const header = (
    <View>
      <AppHeader />
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
        {/* 0일을 큰 포인트 숫자로 쓰면 경고처럼 읽힌다 — 비었으면 흐린 대시로. */}
        <StatCard
          label="연속 기록"
          value={streak.currentStreak > 0 ? `${streak.currentStreak}일` : '—'}
          empty={streak.currentStreak === 0}
        />
        {/* 변화 노트가 있는 단어 수 — 마이페이지와 같은 기준·같은 이름(재정의 횟수 아님). */}
        <StatCard label="생각이 바뀐 단어" value={`${stats.changedWords}`} />
      </View>

      {/* ─── PDF 내보내기 (BM 로드맵) — 기능이 준비될 때까지 가린다 ─── */}
      {SHOW_PDF_EXPORT && (
        <View
          style={[
            styles.exportBtn,
            {
              marginTop: theme.spacing.s6,
              borderColor: theme.colors.line.base,
              backgroundColor: theme.colors.surface.nested,
            },
          ]}
        >
          <Icon name="book" size={22} color={theme.colors.point.p500} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={{ fontWeight: '700' }}>
              PDF로 내보내기
            </ThemedText>
            <ThemedText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              내 사전 한 권으로 소장하기
            </ThemedText>
          </View>
          <View
            style={[
              styles.soonBadge,
              {
                backgroundColor: theme.colors.surface.base,
                borderColor: theme.colors.line.base,
              },
            ]}
          >
            <ThemedText variant="caption" tone="placeholder">
              준비 중
            </ThemedText>
          </View>
        </View>
      )}

      {/* ─── 3. 검색 ─── */}
      <View style={{ marginTop: theme.spacing.s6 }}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="단어 찾기"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="단어 찾기"
          style={styles.searchInput}
        />
        <View style={styles.searchIcon}>
          <Icon name="search" size={18} color={theme.colors.ink.placeholder} />
        </View>
        {query ? (
          <FadeIn offset={0} style={styles.clearWrap}>
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              style={styles.clearBtn}
            >
              <Icon name="close" size={16} color={theme.colors.ink.secondary} />
            </Pressable>
          </FadeIn>
        ) : null}
      </View>
      {/* 몇 개가 걸렸는지 한눈에 — 결과가 0이면 아래 빈 결과 안내가 대신 말한다. */}
      {searching && results.length > 0 ? (
        <FadeIn offset={0}>
          <ThemedText variant="caption" tone="secondary" style={{ marginTop: theme.spacing.s3 }}>
            {results.length}개 찾았어요
          </ThemedText>
        </FadeIn>
      ) : null}
      <View style={{ height: theme.spacing.s4 }} />
    </View>
  );

  return (
    <ThemedView bg="paper" style={styles.root}>
      {/* ─── 4. 단어 리스트 ─── */}
      <FlatList
        data={results}
        keyExtractor={(r) => r.item.word}
        renderItem={({ item: r, index }) => (
          // stagger는 첫 화면(8행)까지만 — 스크롤로 늦게 붙는 행까지 기다리게 하지 않는다.
          <FadeIn delay={index < 8 ? index * 40 : 0}>
            <WordRow item={r.item} highlight={r.range} onPress={() => openWord(r.item.word)} />
          </FadeIn>
        )}
        ItemSeparatorComponent={RowGap}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <FadeIn style={styles.noResult}>
            <ThemedText variant="body" tone="secondary" style={{ textAlign: 'center' }}>
              ‘{query.trim()}’에 맞는 단어가 없어요
            </ThemedText>
            <Button
              label="지우기"
              variant="ghost"
              size="sm"
              onPress={() => setQuery('')}
              style={{ marginTop: theme.spacing.s4 }}
            />
          </FadeIn>
        }
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        // 키보드가 떠 있어도 행·지우기 버튼이 첫 탭에 눌리게, 스크롤하면 키보드는 내려가게.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </ThemedView>
  );
}

// 행 사이 간격 — 매 렌더 새로 만들지 않게 모듈 수준에 둔다.
function RowGap() {
  return <View style={{ height: 10 }} />;
}

// 통계 한 칸 — 이 화면에서만 쓰는 작은 헬퍼라 인라인.
// empty: 아직 값이 없음 — 숫자 대신 흐린 색으로 그린다.
function StatCard({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
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
          fontFamily: theme.fonts.sans,
          fontWeight: '800',
          fontSize: 22,
          color: empty ? theme.colors.ink.placeholder : theme.colors.point.p600,
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
  headerWrap: { paddingHorizontal: 24, paddingTop: 24 },
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
  // 아이콘(왼쪽)·지우기(오른쪽) 자리만큼 글자를 안쪽으로
  searchInput: { paddingLeft: 42, paddingRight: 42 },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  clearWrap: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center' },
  clearBtn: { padding: 6 },
  noResult: { alignItems: 'center', paddingTop: 32 },
  // PDF 내보내기 placeholder — 점선+반투명으로 "준비 중" 신호
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  soonBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
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
