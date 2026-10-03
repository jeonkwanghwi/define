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
  // ─── 읽는 글: 나눔명조 ───────────────────────────────────
  // 정적 폰트라 fontWeight로 두께를 못 고른다 → 두께별 패밀리를 직접 지정하고
  // fontWeight는 비워 둔다(지정하면 iOS가 가짜 굵게를 덧씌워 뭉갠다).

  // 메인 화면의 "오늘의 단어" 같은 디스플레이 (가장 크고 인상적)
  display: {
    fontFamily: fontFamily.serifBold,
    fontSize: 44,
    lineHeight: 58, // 44 * 1.32 — 명조는 글자 상자를 꽉 채워 여유가 더 필요하다
    letterSpacing: -0.5,
  } satisfies TextStyle,

  h1: {
    fontFamily: fontFamily.serifBold,
    fontSize: 30,
    lineHeight: 42, // 30 * 1.4
  } satisfies TextStyle,

  h2: {
    fontFamily: fontFamily.serifBold,
    fontSize: 22,
    lineHeight: 32, // 22 * 1.45
  } satisfies TextStyle,

  h3: {
    fontFamily: fontFamily.serifBold,
    fontSize: 18,
    lineHeight: 27, // 18 * 1.5
  } satisfies TextStyle,

  // 본문 — 사용자가 쓴 정의·회상 대화처럼 "읽는" 글
  body: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
    lineHeight: 28, // 16 * 1.75 — 명조 본문은 줄간격을 더 벌려야 읽힌다
  } satisfies TextStyle,

  // 본문 강조
  bodyMd: {
    fontFamily: fontFamily.serifBold,
    fontSize: 16,
    lineHeight: 28,
  } satisfies TextStyle,

  // ─── 조작하는 글: Pretendard ─────────────────────────────
  // 명조는 이 크기에서 획이 뭉개진다. 버튼·라벨·글자수처럼 빠르게 훑는 글은 산세리프.

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
