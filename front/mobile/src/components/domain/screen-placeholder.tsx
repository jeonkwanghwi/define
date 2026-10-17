/**
 * 화면 진입 직후 보이는 임시 placeholder.
 *
 * Task #6 단계에서 5개 탭이 잘 작동하는지 시각 확인용.
 * 각 화면이 본격 구현되면(Task #7 이후) 호출 측에서 이 컴포넌트 사용을 제거.
 *
 * 사용:
 *   <ScreenPlaceholder iconName="plaza" title="광장" subtitle="..." note="..." />
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import { controlPresets, radii, useTheme } from '@/theme';

export type ScreenPlaceholderProps = {
  iconName: IconName;
  title: string;
  subtitle?: string;
  /** 개발 메모 등 — 가장 흐린 톤으로 표시 */
  note?: string;
  /** 제목 위 작은 상태 배지(예: "준비 중") — 고장이 아니라 아직 안 열린 곳임을 한눈에. */
  badge?: string;
};

export function ScreenPlaceholder({ iconName, title, subtitle, note, badge }: ScreenPlaceholderProps) {
  const theme = useTheme();

  return (
    <ThemedView bg="paper" style={styles.container}>
      <Icon name={iconName} size={56} color={theme.colors.point.p600} />
      {badge ? (
        <View
          style={[
            controlPresets.badge,
            { marginTop: theme.spacing.s4, borderRadius: radii.pill, backgroundColor: theme.colors.point.p100 },
          ]}
        >
          <ThemedText variant="caption" style={{ color: theme.colors.point.p700, fontWeight: '600' }}>
            {badge}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText variant="h2" style={{ marginTop: badge ? theme.spacing.s2 : theme.spacing.s4 }}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText
          variant="body"
          tone="secondary"
          style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}
        >
          {subtitle}
        </ThemedText>
      ) : null}
      {note ? (
        <ThemedText
          variant="caption"
          tone="placeholder"
          style={{ marginTop: theme.spacing.s6 }}
        >
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
