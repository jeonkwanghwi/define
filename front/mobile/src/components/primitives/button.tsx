/**
 * Button — 디자인 토큰을 적용한 누름 가능 버튼.
 *
 * variant:
 *   - primary: 포인트 색 배경 + 흰 텍스트 + point 글로우 (강조 액션)
 *   - soft:    옅은 포인트 배경 + 진한 포인트 텍스트 (부드러운 액션)
 *   - ghost:   투명 배경 + 포인트 텍스트 + 라인 보더 (보조 액션)
 *
 * size:        md(기본) | sm
 * fullWidth:   가로 100% (행 끝까지 채울 때)
 * leftIcon/rightIcon: <Icon name="..." /> 등 ReactNode
 *
 * 사용:
 *   <Button label="저장" onPress={save} />
 *   <Button label="다시 뽑기" variant="ghost" size="sm" leftIcon={<Icon name="shuffle" size={16} />} />
 */
import type { ReactNode } from 'react';
import { type PressableProps, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';

type Variant = 'primary' | 'soft' | 'ghost';
type Size = 'md' | 'sm';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** 컨테이너에 추가할 외부 스타일 (margin, flex 등). 내부 디자인 스타일은 보존되고 뒤에 머지된다. */
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  fullWidth,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();

  // 크기별 패딩과 타입 스케일
  const sizeStyle =
    size === 'sm'
      ? { paddingVertical: 10, paddingHorizontal: 16 }
      : { paddingVertical: 14, paddingHorizontal: 22 };
  const textVariant = size === 'sm' ? 'caption' : 'bodyMd';

  // variant별 배경·보더·텍스트 색 + 강조 액션의 글로우 섀도우
  const palette = {
    primary: {
      backgroundColor: theme.colors.point.p600,
      borderColor: 'transparent',
      textColor: '#FFFFFF',
      shadow: theme.shadows.point,
    },
    soft: {
      backgroundColor: theme.colors.point.p100,
      borderColor: 'transparent',
      textColor: theme.colors.point.p700,
      shadow: undefined,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.line.strong,
      textColor: theme.colors.point.p600,
      shadow: undefined,
    },
  }[variant];

  return (
    <PressableScale
      disabled={disabled}
      style={[
        styles.base,
        sizeStyle,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        palette.shadow,
        fullWidth && styles.fullWidth,
        disabled && { opacity: 0.4 },
        // 외부 style은 마지막 — margin/flex 등 컨테이너 배치 prop을 호출 측이 덮어쓸 수 있게
        style,
      ]}
      {...rest}
    >
      {leftIcon ? <View>{leftIcon}</View> : null}
      {/* pill 버튼 라벨은 항상 한 줄 — 좁은 컨테이너에서 줄바꿈되면 깨져 보임 */}
      <ThemedText variant={textVariant} numberOfLines={1} style={{ color: palette.textColor }}>
        {label}
      </ThemedText>
      {rightIcon ? <View>{rightIcon}</View> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999, // pill — design-source의 모든 .btn 공통
    borderWidth: 1,
  },
  fullWidth: { width: '100%' },
});
