/**
 * ThemedView — 디자인 토큰을 적용한 View 래퍼.
 *
 * bg prop으로 배경 의미를 고르고, 색은 자동 선택.
 *   - paper:         페이지 기본 배경
 *   - paperRecessed: 페이지 안쪽 영역
 *   - surface:       카드 표면
 *   - surfaceNested: 카드 안쪽
 *
 * 사용: <ThemedView bg="surface" style={styles.card}>...</ThemedView>
 */
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export type ThemedViewBg = 'paper' | 'paperRecessed' | 'surface' | 'surfaceNested';

export type ThemedViewProps = ViewProps & {
  bg?: ThemedViewBg;
};

export function ThemedView({ style, bg = 'paper', ...rest }: ThemedViewProps) {
  const theme = useTheme();
  const colors = theme.colors;

  const backgroundColor = {
    paper: colors.paper.base,
    paperRecessed: colors.paper.recessed,
    surface: colors.surface.base,
    surfaceNested: colors.surface.nested,
  }[bg];

  return <View style={[{ backgroundColor }, style]} {...rest} />;
}
