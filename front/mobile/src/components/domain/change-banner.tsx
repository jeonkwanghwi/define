/**
 * ChangeBanner — 단어 상세 화면 상단의 "생각이 변했어요" 안내.
 *
 * 단어장의 JournalWord.changed=true 일 때만 표시.
 * 좌: sparkle 아이콘 / 우: 제목(point 색) + 변화 요약 문구
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type ChangeBannerProps = {
  note: string;
};

export function ChangeBanner({ note }: ChangeBannerProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.point.p050,
          borderColor: theme.colors.point.p100,
          borderRadius: theme.radii.md,
          padding: theme.spacing.s4,
        },
      ]}
    >
      <Icon name="sparkle" size={20} color={theme.colors.point.p600} />
      <View style={styles.text}>
        <ThemedText
          variant="bodyMd"
          style={{ color: theme.colors.point.p700 }}
        >
          생각이 변했어요
        </ThemedText>
        <ThemedText
          variant="sm"
          tone="secondary"
          style={{ marginTop: 2 }}
        >
          {note}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
  },
  text: { flex: 1 },
});
