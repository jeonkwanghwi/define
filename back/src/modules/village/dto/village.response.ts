/**
 * 마을 응답 형태. read-only라 클래스 대신 타입으로 단순화.
 */

/** 집 시트에 보여줄 정의 한 줄. */
export type VillageWordResponse = {
  word: string;
  text: string;
  savedAt: string; // ISO
};

/** 집 한 채의 주인. 후보가 적으면 같은 id가 여러 번 나올 수 있다(중복 배치). */
export type VillageNeighborResponse = {
  id: string;
  nickname: string; // 없으면 '익명'
  words: VillageWordResponse[]; // 최신 5개까지
};

export type VillageNeighborsResponse = { neighbors: VillageNeighborResponse[] };
