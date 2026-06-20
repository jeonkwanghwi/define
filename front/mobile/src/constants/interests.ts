/**
 * 가입 프로필 관심사 — 칩으로 노출. 복수 선택, 최소 1개.
 * ⚠️ 백엔드 `back/src/modules/auth/interests.ts`와 같은 값 유지(수동 동기화).
 */
export const INTERESTS = [
  '독서',
  '글쓰기',
  '영화·드라마',
  '음악',
  '여행',
  '운동·건강',
  '예술·전시',
  '심리·마음',
  '자기계발',
  '일·커리어',
  '관계·사랑',
  '자연·산책',
] as const;

export type Interest = (typeof INTERESTS)[number];
