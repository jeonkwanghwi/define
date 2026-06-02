/**
 * 오늘의 추천 단어 풀.
 *
 * PLANNING.md 5-1 동작 로직: 앱 진입 시 이 풀에서 사용자가 오늘 아직 정의하지 않은
 * 단어를 랜덤으로 한 개 노출. 백엔드 붙으면 서버가 이 풀을 제공하므로
 * `services/word-api.ts`로 교체될 자리.
 *
 * design-source/app/data.jsx의 todayWords와 동일 목록.
 */
export const RECOMMENDED_WORDS: readonly string[] = [
  '행복',
  '사랑',
  '돈',
  '시간',
  '용기',
  '어른',
];
