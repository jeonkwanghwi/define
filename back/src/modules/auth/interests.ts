/**
 * 가입 프로필에서 고를 수 있는 고정 관심사 목록(마을 필터용).
 * ⚠️ 프론트 `front/mobile/src/constants/interests.ts`와 같은 값 유지(별도 패키지라 수동 동기화).
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
