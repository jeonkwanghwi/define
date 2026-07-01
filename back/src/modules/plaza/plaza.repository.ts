/**
 * PlazaRepository — 광장 DB 접근 계약(read-only). 구현은 plaza.repository.prisma.ts.
 * 신규 테이블 없음 — 기존 Entry를 word로 묶어 읽는다.
 */
export type PlazaWordCount = { word: string; count: number };

export type PlazaDefinitionRow = {
  id: string;
  userId: string;
  nickname: string | null;
  text: string;
  savedAt: Date;
  likeCount: number;
  likedByMe: boolean;
};

export abstract class PlazaRepository {
  /** 정의가 1개 이상인 단어 목록 + 정의 수. */
  abstract listWordsWithCounts(): Promise<PlazaWordCount[]>;
  /** 한 단어의 모든 정의(닉네임·좋아요 집계 포함), savedAt 역순. userId로 likedByMe 판정. */
  abstract findDefinitionsByWord(
    word: string,
    userId: string,
  ): Promise<PlazaDefinitionRow[]>;
  /** 정의(Entry)의 작성자 userId. 없으면 null. (자기 좋아요 판정용) */
  abstract getEntryOwner(entryId: string): Promise<string | null>;
  /** 좋아요를 토글하고 토글 후 상태·총 개수를 반환. (userId,entryId) 유니크로 멱등. */
  abstract toggleLike(
    userId: string,
    entryId: string,
  ): Promise<{ liked: boolean; likeCount: number }>;
}
