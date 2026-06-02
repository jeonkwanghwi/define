/**
 * define 디자인 토큰 — 타이포그래피.
 *
 * tokens.css의 8단계 타입 스케일을 RN TextStyle로 옮김.
 * lineHeight는 원본의 배수(예: 1.6) * fontSize를 미리 계산한 값.
 *
 * 사용:
 *   <Text style={theme.typography.display}>오늘의 단어</Text>
 *   또는 ThemedText의 variant prop으로: <ThemedText variant="display">
 */
import type { TextStyle } from 'react-native';

import { fontFamily } from './fonts';

export const typography = {
  // 메인 화면의 "오늘의 단어" 같은 디스플레이 (가장 크고 인상적)
  display: {
    fontFamily: fontFamily.sans,
    fontSize: 44,
    lineHeight: 49, // 44 * 1.12
    fontWeight: '800',
    letterSpacing: -0.5,
  } satisfies TextStyle,

  h1: {
    fontFamily: fontFamily.sans,
    fontSize: 30,
    lineHeight: 36, // 30 * 1.2
    fontWeight: '700',
  } satisfies TextStyle,

  h2: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    lineHeight: 29, // 22 * 1.3
    fontWeight: '700',
  } satisfies TextStyle,

  h3: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    lineHeight: 25, // 18 * 1.4
    fontWeight: '600',
  } satisfies TextStyle,

  // 본문 — 가독성 우선
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 26, // 16 * 1.6
    fontWeight: '400',
  } satisfies TextStyle,

  // 본문 강조 (한 단계 굵게)
  bodyMd: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
  } satisfies TextStyle,

  sm: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 22, // 14 * 1.55
    fontWeight: '400',
  } satisfies TextStyle,

  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 17, // 12 * 1.4
    fontWeight: '500',
  } satisfies TextStyle,
} as const;

export type TypographyVariant = keyof typeof typography;
