/**
 * ThemedText — 디자인 토큰을 적용한 Text 래퍼.
 *
 * variant로 타입 스케일을 고르고, tone으로 텍스트 색 농도를 고른다.
 * 라이트/다크는 자동.
 *
 * 사용:
 *   <ThemedText variant="display">행복이란</ThemedText>
 *   <ThemedText variant="body" tone="secondary">우린 모두 각자의 정의가 있다</ThemedText>
 */
import { Text, type TextProps } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';
import type { Colors } from '@/theme/colors';

type InkTone = keyof Colors['ink']; // primary | strong | secondary | placeholder

export type ThemedTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: InkTone;
};

export function ThemedText({ style, variant = 'body', tone = 'primary', ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      // iOS는 한글을 글자 단위로 줄바꿈한다("흔 / 적") — 단어 단위로 끊게 한다. 뒤의 rest로 덮어쓸 수 있다.
      lineBreakStrategyIOS="hangul-word"
      style={[theme.typography[variant], { color: theme.colors.ink[tone] }, style]}
      {...rest}
    />
  );
}
