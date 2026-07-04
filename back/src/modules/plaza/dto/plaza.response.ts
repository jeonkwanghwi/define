/**
 * 광장 응답 형태. read-only라 클래스 대신 타입으로 단순화.
 */

/** 단어 카드에 미리보기로 얹는 대표 정의(추천순 tie 최신순 상위 N). */
export type PlazaPreviewResponse = {
  id: string;
  nickname: string; // 없으면 '익명'
  text: string;
  likeCount: number;
};

export type PlazaWordResponse = {
  word: string;
  count: number;
  previews: PlazaPreviewResponse[]; // 추천순(동률 최신순) 상위 2개
};

/** 광장 상단 "이번 주" 통계 블록. */
export type PlazaStatsResponse = {
  weekDefinitions: number; // 최근 7일 작성된 정의 수
  weekContributors: number; // 최근 7일 정의를 남긴 사람 수
  myWeekLikesReceived: number; // 내 정의가 최근 7일 받은 좋아요 수
  topLikedWord: { word: string; likeCount: number } | null; // 정의 총 좋아요가 가장 많은 단어
  mostDefinedWord: { word: string; count: number } | null; // 정의 수가 가장 많은(갈리는) 단어
};

export type PlazaDefinitionResponse = {
  id: string;
  nickname: string; // 없으면 '익명'
  text: string;
  savedAt: string; // ISO
  isMine: boolean;
  likeCount: number;
  isLiked: boolean; // 요청 사용자가 이 정의에 좋아요를 눌렀는지
};

export type PlazaWordDetailResponse = {
  word: string;
  definitions: PlazaDefinitionResponse[];
};

export type PlazaLikeResponse = { liked: boolean; likeCount: number };
