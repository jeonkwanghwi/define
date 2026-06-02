/**
 * Card — surface 카드 컨테이너.
 *
 * 디자인 패턴: surface 배경 + line 보더 + 라운드 + (선택) 섀도우.
 * design-source의 .word-row, .input-stage, .reciprocity 등에서 반복되는 형태를 통일.
 *
 * props:
 *   - bg:         'surface' (기본) | 'surfaceNested'
 *   - padded:     기본 true. false면 직접 콘텐츠 padding 제어
 *   - elevation:  'sm' (기본) | 'md' | 'none' — 섀도우 강도
 *   - radius:     'md' (기본) | 'lg' | 'xl' — 코너 라운드
 *
 * 사용:
 *   <Card>...</Card>                                   // 기본
 *   <Card radius="lg" elevation="md">...</Card>        // 더 큰 라운드 + 진한 섀도우
 *   <Card padded={false} style={{ padding: 20 }}>...</Card>  // 패딩 직접 제어
 */
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export type CardProps = ViewProps & {
  bg?: 'surface' | 'surfaceNested';
  padded?: boolean;
  elevation?: 'none' | 'sm' | 'md';
  radius?: 'md' | 'lg' | 'xl';
};

export function Card({
  bg = 'surface',
  padded = true,
  elevation = 'sm',
  radius = 'md',
  style,
  children,
  ...rest
}: CardProps) {
  const theme = useTheme();

  const backgroundColor =
    bg === 'surfaceNested' ? theme.colors.surface.nested : theme.colors.surface.base;
  const shadow = elevation === 'none' ? undefined : theme.shadows[elevation];

  return (
    <View
      style={[
        {
          backgroundColor,
          borderColor: theme.colors.line.base,
          borderWidth: 1,
          borderRadius: theme.radii[radius],
          padding: padded ? theme.spacing.s4 : 0,
        },
        shadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
