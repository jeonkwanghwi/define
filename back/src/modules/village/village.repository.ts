/**
 * VillageRepository — 마을 DB 접근 계약(read-only). 구현은 village.repository.prisma.ts.
 * 신규 테이블 없음 — 기존 User·Entry를 "사람 → 단어" 방향으로 읽는다(광장의 반대).
 */
/** 이웃 후보 한 명(닉네임은 원본 null 가능 — service에서 '익명' 처리). */
export type VillageNeighborRow = {
  id: string;
  nickname: string | null;
  words: { word: string; text: string; savedAt: Date }[]; // 최신순
};

export abstract class VillageRepository {
  /**
   * 이웃 후보 = 정의가 1개 이상인 유저(요청자 제외).
   * 각 유저의 정의는 최신 wordsPerUser개까지.
   */
  abstract findNeighborCandidates(
    excludeUserId: string,
    wordsPerUser: number,
  ): Promise<VillageNeighborRow[]>;
}
