/**
 * word-api — 오늘의 단어 풀 호출. 백엔드 계약(GET /api/words/recommended)에 1:1.
 *
 * **토큰은 선택이다.** 홈은 로그인 없이도 쓰는 화면이라 서버가 토큰 없는 요청도 200으로
 * 받는다(없거나 만료면 비로그인 취급). 로그인했으면 관심사가 반영되고, 최근 90일 안에
 * 정의한 단어는 빠진다 — 그 판단은 전부 서버에 있다.
 */
import { apiRequest } from './api-client';

/**
 * GET /api/words/recommended — 앱은 이 풀 안에서 "다시 뽑기"를 돌린다.
 * 서버는 빈 배열을 주지 않는다(풀보다 큰 limit이면 있는 만큼).
 */
export async function getRecommendedWords(
  token: string | null,
  limit = 30,
): Promise<string[]> {
  const { words } = await apiRequest<{ words: string[] }>(
    `/words/recommended?limit=${limit}`,
    { method: 'GET', token: token ?? undefined },
  );
  return words;
}
