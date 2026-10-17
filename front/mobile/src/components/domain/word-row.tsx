/**
 * WordRow — 단어장 리스트의 한 행.
 *
 * 좌: 단어(h3) + (오늘 쓴 단어면 '오늘' 뱃지) + 최신 정의 한 줄 (말줄임)
 * 우: 정의 횟수 뱃지("N번", 2번 이상일 때만) + chevronR
 *   ("변화" 뱃지는 2026-07-17 제거 — 기준이 '2회 이상 정의'라 실제 변화와 무관했고,
 *    쓸수록 모든 행에 붙어 신호가 죽음. 역사의 존재는 횟수 뱃지가 전달.)
 *
 * 누름 시 onPress 호출. 화면 측에서 router.push로 단어 상세로 이동.
 */
import { StyleSheet, View } from 'react-native';

import { Card, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { formatYmd } from '@/lib/format-date';
import { controlPresets, useTheme } from '@/theme';
import type { JournalWord } from '@/types/word';

export type WordRowProps = {
  item: JournalWord;
  onPress: () => void;
};

export function WordRow({ item, onPress }: WordRowProps) {
  const theme = useTheme();
  // 방금 쓴 단어 표시 — 기록 화면의 '오늘' 뱃지와 같은 모양. date는 'YYYY.MM.DD'.
  const isToday = item.entries[0]?.date === formatYmd(new Date());
  const count = item.entries.length;

  return (
    <PressableScale onPress={onPress}>
      <Card style={styles.row}>
        {/* 좌측 메인 정보 */}
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <ThemedText variant="h3">{item.word}</ThemedText>
            {isToday ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.point.p050 }]}>
                <ThemedText variant="caption" style={{ color: theme.colors.point.p600 }}>
                  오늘
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText
            variant="sm"
            tone="secondary"
            numberOfLines={1}
            style={{ marginTop: 3 }}
          >
            {item.entries[0]?.text}
          </ThemedText>
          {/* 변화 노트 미리보기 — 최신 정의에 노트가 있을 때만(위 줄의 정의와 짝). point 톤 한 줄. */}
          {item.changeNote ? (
            <View style={styles.notePreview}>
              <Icon name="arrowUp" size={12} color={theme.colors.point.p600} />
              <ThemedText
                variant="caption"
                numberOfLines={1}
                style={{ flex: 1, color: theme.colors.point.p600 }}
              >
                {item.changeNote}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* 우측 메타 — 위: 개수/화살표, 아래: 마지막 날짜(우하단) */}
        <View style={styles.side}>
          <View style={styles.metaRow}>
            {/* 다시 정의한 단어만 표시 — 한 번뿐인 단어까지 "1"을 달면 신호가 묽어진다. */}
            {count >= 2 ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.point.p050 }]}>
                <ThemedText variant="caption" style={{ color: theme.colors.point.p700, fontWeight: '600' }}>
                  {count}번
                </ThemedText>
              </View>
            ) : null}
            <Icon name="chevronR" size={16} color={theme.colors.ink.placeholder} />
          </View>
          {item.entries[0]?.date ? (
            <ThemedText variant="caption" tone="placeholder">
              {item.entries[0].date}
            </ThemedText>
          ) : null}
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  main: { flex: 1, minWidth: 0 },
  notePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  side: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { ...controlPresets.badge, borderRadius: 999 },
});
