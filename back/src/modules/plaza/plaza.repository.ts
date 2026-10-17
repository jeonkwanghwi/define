/**
 * PlazaRepository — 광장 DB 접근 계약. 구현은 plaza.repository.prisma.ts.
 * 조회는 기존 Entry를 word로 묶어 읽고, 중재(신고·차단)는 Report·Block을 쓴다.
 */
/** 카드 미리보기 정의(닉네임은 원본 null 가능 — service에서 '익명' 처리). */
export type PlazaPreviewRow = {
  id: string;
  nickname: string | null;
  text: string;
  likeCount: number;
};

export type PlazaWordCount = {
  word: string;
  count: number;
  previews: PlazaPreviewRow[]; // 추천순 tie 최신순 상위 2
  lastActivityAt: Date; // 활동순 정렬용(응답엔 미포함)
};

/** 광장 통계 원자료. topLikedWord/mostDefinedWord는 없으면 null. */
export type PlazaStatsRow = {
  weekDefinitions: number;
  weekContributors: number;
  myWeekLikesReceived: number;
  topLikedWord: { word: string; likeCount: number } | null;
  mostDefinedWord: { word: string; count: number } | null;
};

export type PlazaDefinitionRow = {
  id: string;
  userId: string;
  nickname: string | null;
  text: string;
  savedAt: Date;
  likeCount: number;
  likedByMe: boolean;
};

/** 차단 목록에 쓰는 사람 한 줄(닉네임은 원본 null 가능 — service에서 '익명' 처리). */
export type PlazaBlockedUserRow = {
  id: string;
  nickname: string | null;
};

export abstract class PlazaRepository {
  /**
   * 정의가 1개 이상인 단어 목록(활동순) + 정의 수 + 대표 정의 미리보기 2개.
   * limit으로 상위 N개만 가져온다 — 전부 가져오면 데이터가 늘수록 선형으로 느려진다.
   * userId를 주면 그 사람이 차단한 작성자의 정의를 뺀다. 없으면(비로그인) 숨김만 적용된다.
   */
  abstract listWordsWithCounts(
    limit: number,
    userId?: string,
  ): Promise<PlazaWordCount[]>;
  /** 광장 상단 통계. since = "최근 N일" 경계. userId = 내 정의 좋아요 집계용. */
  abstract getStats(userId: string, since: Date): Promise<PlazaStatsRow>;
  /**
   * 한 단어의 정의들(닉네임·좋아요 집계 포함). userId로 likedByMe 판정.
   * 숨겨진 정의와 내가 차단한 작성자의 정의는 빠진다.
   *   - mine: true  → 내 정의 전부, 최신순.
   *   - mine: false → 남의 정의를 좋아요 많은 순 → 최신순으로 skip/take만큼.
   */
  abstract findDefinitionsByWord(
    word: string,
    userId: string,
    page: { mine: true } | { mine: false; skip: number; take: number },
  ): Promise<PlazaDefinitionRow[]>;
  /** 정의(Entry)의 작성자 userId. 없으면 null. (자기 좋아요 판정용) */
  abstract getEntryOwner(entryId: string): Promise<string | null>;
  /** 좋아요를 토글하고 토글 후 상태·총 개수를 반환. (userId,entryId) 유니크로 멱등. */
  abstract toggleLike(
    userId: string,
    entryId: string,
  ): Promise<{ liked: boolean; likeCount: number }>;
  /**
   * 신고 1건을 남기고 누적 수를 올린다. 이미 신고한 글이면 아무 일도 하지 않는다(멱등).
   * hideThreshold에 닿으면 같은 트랜잭션에서 hidden을 켠다 — 임계치는 service가 정한다.
   */
  abstract addReport(
    reporterId: string,
    entryId: string,
    reason: string,
    hideThreshold: number,
  ): Promise<void>;
  /** 차단. 이미 차단한 사람이면 아무 일도 하지 않는다(멱등). */
  abstract addBlock(blockerId: string, blockedId: string): Promise<void>;
  /** 차단 해제. 차단한 적 없어도 조용히 지나간다(멱등). */
  abstract removeBlock(blockerId: string, blockedId: string): Promise<void>;
  /** 내가 차단한 사람들(최근 차단 순). */
  abstract listBlocked(blockerId: string): Promise<PlazaBlockedUserRow[]>;
}
