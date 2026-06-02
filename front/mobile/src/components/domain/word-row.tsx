/**
 * WordRow — 단어장 리스트의 한 행.
 *
 * 좌: 단어(h3) + 최신 정의 한 줄 (말줄임)
 * 우: (변화 뱃지) + 정의 횟수(작은 원) + chevronR
 *
 * 누름 시 onPress 호출. 화면 측에서 router.push로 단어 상세로 이동.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';
import type { JournalWord } from '@/types/word';

export type WordRowProps = {
  item: JournalWord;
  onPress: () => void;
};

export function WordRow({ item, onPress }: WordRowProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <Card style={styles.row}>
        {/* 좌측 메인 정보 */}
        <View style={styles.main}>
          <ThemedText variant="h3">{item.word}</ThemedText>
          <ThemedText
            variant="sm"
            tone="secondary"
            numberOfLines={1}
            style={{ marginTop: 3 }}
          >
            {item.entries[0]?.text}
          </ThemedText>
        </View>

        {/* 우측 메타 */}
        <View style={styles.side}>
          {item.changed ? (
            <View
              style={[
                styles.changeBadge,
                {
                  backgroundColor: theme.colors.point.p050,
                  borderColor: theme.colors.point.p100,
                },
              ]}
            >
              <Icon name="arrowUp" size={11} color={theme.colors.point.p600} />
              <ThemedText
                variant="caption"
                style={{ color: theme.colors.point.p600 }}
              >
                변화
              </ThemedText>
            </View>
          ) : null}
          <View
            style={[
              styles.countCircle,
              { backgroundColor: theme.colors.surface.nested },
            ]}
          >
            <ThemedText variant="caption" tone="placeholder">
              {item.entries.length}
            </ThemedText>
          </View>
          <Icon name="chevronR" size={16} color={theme.colors.ink.placeholder} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  main: { flex: 1, minWidth: 0 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  countCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
