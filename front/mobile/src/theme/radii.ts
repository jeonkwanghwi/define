/**
 * define 디자인 토큰 — 라운드 코너.
 *
 * tokens.css의 --r-N 시리즈를 그대로 옮김.
 * 카드/버튼/시트 등 surface 모양 통일에 사용.
 *
 * 사용: borderRadius: theme.radii.md
 */
export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999, // 완전한 둥근 버튼/뱃지
} as const;

export type RadiusKey = keyof typeof radii;
