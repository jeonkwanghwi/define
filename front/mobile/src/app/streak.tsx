/**
 * 연속 기록 화면 — 헤더의 "연속 N일" 칩을 누르면 온다.
 *
 * 세 덩어리:
 *   1. 지금 연속 N일 · 최장 M일 + 오늘 한 줄 안내(다그치지 않는 말투)
 *   2. 월 달력 — 쓴 날은 호박색으로 칠하고(많이 쓴 날일수록 진하게) 날짜 아래에 쓴 개수를 적는다.
 *      방어권이 막아 준 빈 날은 점선 테두리 + 방패, 오늘은 테두리.
 *   3. 연속 방어권 — 지금 있는지, 썼으면 며칠 뒤 다시 생기는지.
 *
 * 데이터는 이 폰의 단어장(journal-store)만 쓴다 — 로그인 없이도, 오프라인에서도 같은 화면.
 * 날짜는 기기 시간대 기준(lib/streak의 dayIndex). 규칙은 서버 보상과 같다(lib/streak 참고).
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/domain/screen-header';
import { FadeIn, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { dayIndex, FREEZE_GAP_DAYS } from '@/lib/streak';
import { useJournalStore, useJournalStreak } from '@/store/journal-store';
import { useTheme } from '@/theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function StreakScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const entries = useJournalStore((s) => s.entries);
  const streak = useJournalStreak();

  const today = new Date();
  const todayIdx = dayIndex(today);
  // 보고 있는 달 — 처음엔 이번 달. { y, m(0~11) }
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const isThisMonth = view.y === today.getFullYear() && view.m === today.getMonth();

  // 날짜별 쓴 개수 — 달력이 칸마다 꺼내 쓴다.
  const countByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of entries) {
      const d = dayIndex(new Date(e.savedAt));
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [entries]);
  const frozen = useMemo(() => new Set(streak.frozenDays), [streak.frozenDays]);

  // 이 달의 칸들 — 앞쪽 빈칸(요일 맞춤) + 날짜. 6줄을 넘지 않는다.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (null | { date: number; idx: number })[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push({ date: d, idx: dayIndex(new Date(view.y, view.m, d)) });
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const monthDays = cells.filter((c) => c && countByDay.has(c.idx)).length;
  const monthEntries = cells.reduce((sum, c) => sum + (c ? (countByDay.get(c.idx) ?? 0) : 0), 0);

  const message = streak.writtenToday
    ? '오늘도 한 줄 남겼어요'
    : streak.currentStreak > 0
      ? '오늘 한 줄이면 연속이 이어져요'
      : '오늘의 한 줄로 다시 시작해 봐요';

  function moveMonth(delta: number) {
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  /** 많이 쓴 날일수록 진하게 — 1개 / 2개 / 3개 이상. */
  function fillFor(count: number) {
    if (count >= 3) return { bg: theme.colors.point.p600, fg: theme.colors.ink.onPoint };
    if (count === 2) return { bg: theme.colors.point.p300, fg: theme.colors.ink.strong };
    return { bg: theme.colors.point.p100, fg: theme.colors.ink.strong };
  }

  const freezeReady = streak.freezeReadyInDays === 0;

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title="연속 기록" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.s10 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 지금 · 최장 */}
        <FadeIn>
          <View style={styles.hero}>
            <View style={styles.heroCol}>
              <ThemedText variant="caption" tone="secondary" style={styles.heroLabel}>
                지금 연속
              </ThemedText>
              <ThemedText variant="display" style={{ color: theme.colors.point.p600 }}>
                {streak.currentStreak}
                <ThemedText variant="h2" style={{ color: theme.colors.point.p600 }}>일</ThemedText>
              </ThemedText>
            </View>
            <Icon name="flame" size={40} color={theme.colors.point.p600} />
            <View style={styles.heroCol}>
              <ThemedText variant="caption" tone="secondary" style={styles.heroLabel}>
                최장 연속
              </ThemedText>
              <ThemedText variant="display" tone="secondary">
                {streak.longestStreak}
                <ThemedText variant="h2" tone="secondary">일</ThemedText>
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="body" tone="secondary" style={styles.message}>
            {message}
          </ThemedText>
        </FadeIn>

        {/* 2. 달력 */}
        <FadeIn delay={60}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface.base, borderRadius: theme.radii.lg }]}>
            <View style={styles.monthRow}>
              <PressableScale onPress={() => moveMonth(-1)} hitSlop={10} accessibilityLabel="이전 달" style={styles.monthBtn}>
                <Icon name="back" size={20} color={theme.colors.ink.secondary} />
              </PressableScale>
              <ThemedText variant="h3">
                {view.y}년 {view.m + 1}월
              </ThemedText>
              <PressableScale
                onPress={() => moveMonth(1)}
                hitSlop={10}
                disabled={isThisMonth}
                accessibilityLabel="다음 달"
                style={[styles.monthBtn, { opacity: isThisMonth ? 0.25 : 1 }]}
              >
                {/* 뒤집기는 아이콘을 감싼 View에 — PressableScale은 눌림 애니메이션으로 transform을 덮어쓴다. */}
                <View style={{ transform: [{ scaleX: -1 }] }}>
                  <Icon name="back" size={20} color={theme.colors.ink.secondary} />
                </View>
              </PressableScale>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <ThemedText
                  key={w}
                  variant="caption"
                  style={[styles.weekday, { color: i === 0 ? theme.colors.ruby.base : theme.colors.ink.secondary }]}
                >
                  {w}
                </ThemedText>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((c, i) => {
                if (!c) return <View key={`e${i}`} style={styles.cell} />;
                const count = countByDay.get(c.idx) ?? 0;
                const isToday = c.idx === todayIdx;
                const isFuture = c.idx > todayIdx;
                const isFrozen = frozen.has(c.idx);
                const fill = count > 0 ? fillFor(count) : null;
                return (
                  <View key={c.idx} style={styles.cell}>
                    <View
                      style={[
                        styles.dot,
                        fill && { backgroundColor: fill.bg },
                        isToday && !fill && { borderWidth: 1.5, borderColor: theme.colors.point.p600 },
                        isFrozen && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.ink.secondary },
                      ]}
                    >
                      {isFrozen ? (
                        <Icon name="shield" size={16} color={theme.colors.ink.secondary} />
                      ) : (
                        <ThemedText
                          variant="sm"
                          style={{
                            color: fill ? fill.fg : isFuture ? theme.colors.ink.placeholder : theme.colors.ink.primary,
                            fontWeight: fill || isToday ? '700' : '500',
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {c.date}
                        </ThemedText>
                      )}
                    </View>
                    {/* 그날 쓴 개수 — 0이면 비워 둔다(줄 높이는 유지해 칸이 들쭉날쭉하지 않게). */}
                    <ThemedText variant="caption" tone="secondary" style={styles.count}>
                      {count > 0 ? `${count}개` : isFrozen ? '방어' : ' '}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            <ThemedText variant="sm" tone="secondary" style={styles.monthSummary}>
              {view.m + 1}월에는 {monthDays}일 동안 정의 {monthEntries}개를 썼어요
            </ThemedText>
          </View>
        </FadeIn>

        {/* 3. 연속 방어권 */}
        <FadeIn delay={120}>
          <View
            style={[
              styles.card,
              styles.freezeCard,
              { backgroundColor: theme.colors.surface.base, borderRadius: theme.radii.lg },
            ]}
          >
            <Icon name="shield" size={28} color={freezeReady ? theme.colors.point.p600 : theme.colors.ink.placeholder} />
            <View style={styles.freezeText}>
              <ThemedText variant="label">연속 방어권</ThemedText>
              <ThemedText variant="sm" tone="secondary">
                하루 빠져도 연속이 끊기지 않게 자동으로 막아 줘요 · {FREEZE_GAP_DAYS}일에 한 번
              </ThemedText>
            </View>
            <ThemedText
              variant="label"
              style={{ color: freezeReady ? theme.colors.point.p600 : theme.colors.ink.secondary, fontWeight: '700' }}
            >
              {freezeReady ? '1개' : `${streak.freezeReadyInDays}일 뒤`}
            </ThemedText>
          </View>
        </FadeIn>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  heroCol: { alignItems: 'center', minWidth: 110 },
  heroLabel: { letterSpacing: 0.5, marginBottom: 2 },
  message: { textAlign: 'center', marginTop: 4 },
  card: { padding: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 7칸이 정확히 한 줄 — 퍼센트 폭으로 나눠 기기 폭과 무관하게 맞춘다.
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 10, lineHeight: 13, marginTop: 2 },
  monthSummary: { textAlign: 'center', marginTop: 8 },
  freezeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  freezeText: { flex: 1, minWidth: 0, gap: 2 },
});
