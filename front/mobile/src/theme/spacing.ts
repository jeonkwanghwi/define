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

/**
 * 뱃지/칩류 공통 패딩 프리셋.
 * 화면마다 2/8, 3/8, 5/10, 6/12… 제각각이던 것을 역할별 3단계로 표준화.
 * (기존 파일 소급 적용은 하지 않음 — 손대는 파일에서만 사용.)
 */
export const controlPresets = {
  /** 상태 뱃지 — '오늘' · '내 정의' · '변화' */
  badge: { paddingVertical: 2, paddingHorizontal: 8 },
  /** 카운트 pill — 통계 칩 · 좋아요 */
  pill: { paddingVertical: 6, paddingHorizontal: 12 },
  /** 선택형 chip — 필터 · 날짜 */
  chip: { paddingVertical: 8, paddingHorizontal: 14 },
} as const;
