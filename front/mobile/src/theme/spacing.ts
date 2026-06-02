/**
 * define 디자인 토큰 — 스페이싱 (4pt base).
 *
 * tokens.css의 --s-N 시리즈 그대로. 키의 숫자는 "4의 배수 인덱스"가 아니라
 * 원본 키와 매핑 편의를 위한 라벨 (예: s4 = 16px, s6 = 24px).
 *
 * 사용: padding: theme.spacing.s4, gap: theme.spacing.s2
 */
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
} as const;

export type SpacingKey = keyof typeof spacing;
