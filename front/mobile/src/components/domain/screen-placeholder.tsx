/**
 * 화면 진입 직후 보이는 임시 placeholder.
 *
 * Task #6 단계에서 5개 탭이 잘 작동하는지 시각 확인용.
 * 각 화면이 본격 구현되면(Task #7 이후) 호출 측에서 이 컴포넌트 사용을 제거.
 *
 * 사용:
 *   <ScreenPlaceholder iconName="plaza" title="광장" subtitle="..." note="..." />
 */
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, type IconName } from '@/icons';
import { useTheme } from '@/theme';

export type ScreenPlaceholderProps = {
  iconName: IconName;
  title: string;
  subtitle?: string;
  /** 개발 메모 등 — 가장 흐린 톤으로 표시 */
  note?: string;
};

export function ScreenPlaceholder({ iconName, title, subtitle, note }: ScreenPlaceholderProps) {
  const theme = useTheme();

  return (
    <ThemedView bg="paper" style={styles.container}>
      <Icon name={iconName} size={56} color={theme.colors.point.p600} />
      <ThemedText variant="h2" style={{ marginTop: theme.spacing.s4 }}>
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
