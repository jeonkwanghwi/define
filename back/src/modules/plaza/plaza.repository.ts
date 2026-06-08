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
};

export abstract class PlazaRepository {
  /** 정의가 1개 이상인 단어 목록 + 정의 수. */
  abstract listWordsWithCounts(): Promise<PlazaWordCount[]>;
  /** 한 단어의 모든 정의(작성자 닉네임 포함), savedAt 역순. */
  abstract findDefinitionsByWord(word: string): Promise<PlazaDefinitionRow[]>;
}
