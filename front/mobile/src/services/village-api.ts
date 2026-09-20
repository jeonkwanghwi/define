/**
 * village-api — 마을(tab2) 조회. GET /api/village/* (Bearer 필요).
 * 서버는 "누구를 넣을지"만 정하고, 어느 집에 앉힐지는 클라가 순서대로 배정한다.
 */
import { apiRequest } from './api-client';

/** 집 시트에 보여줄 정의 한 줄. */
export type VillageWord = {
  word: string;
  text: string;
  savedAt: string; // ISO
};

/** 집 한 채의 주인. 후보가 적으면 같은 id가 여러 번 올 수 있다(중복 배치). */
export type VillageNeighbor = {
  id: string;
  nickname: string; // 없으면 '익명'
  words: VillageWord[]; // 최신 5개까지
};

/**
 * GET /api/village/neighbors?count=N — 집에 앉힐 이웃 표본.
 * 정확히 count개가 오고(모자라면 중복), 매 호출 순서가 다르다 = 새로고침.
 */
export function getNeighbors(token: string, count: number): Promise<VillageNeighbor[]> {
  return apiRequest<{ neighbors: VillageNeighbor[] }>(`/village/neighbors?count=${count}`, {
    method: 'GET',
    token,
  }).then((res) => res.neighbors);
}
