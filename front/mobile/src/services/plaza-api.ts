/**
 * plaza-api — 광장 조회 + 중재(신고·차단). /api/plaza/* (Bearer 필요).
 * 단어는 한글이라 path에 encodeURIComponent.
 */
import { apiRequest } from './api-client';

export type PlazaPreview = {
  id: string;
  nickname: string; // 없으면 '익명'
  text: string;
  likeCount: number;
  isMine?: boolean; // 구버전 서버는 안 내려준다 → undefined = 내 글 아님
};

export type PlazaWord = {
  word: string;
  count: number;
  myCount?: number; // 이 단어에 남긴 내 정의 수(구버전 서버면 undefined = 0)
  previews: PlazaPreview[]; // 추천순(동률 최신순) 상위 2개
};

export type PlazaStats = {
  weekDefinitions: number;
  weekContributors: number;
  myWeekLikesReceived: number;
  topLikedWord: { word: string; likeCount: number } | null;
  mostDefinedWord: { word: string; count: number } | null;
};

export type PlazaDefinition = {
  id: string;
  /** 작성자 userId — 차단 호출에 필요하다(닉네임은 바뀔 수 있어 id로만 가리킨다). */
  authorId: string;
  nickname: string;
  text: string;
  savedAt: string;
  isMine: boolean;
  likeCount: number;
  isLiked: boolean;
};

export type PlazaWordDetail = {
  word: string;
  definitions: PlazaDefinition[];
  /** 다음 쪽이 더 있는가. 옛 서버는 이 값을 안 준다 → undefined = 더 없음으로 읽는다. */
  hasMore?: boolean;
};

/** GET /api/plaza/words */
export function getPlazaWords(token: string): Promise<PlazaWord[]> {
  return apiRequest<PlazaWord[]>('/plaza/words', { method: 'GET', token });
}

/** GET /api/plaza/stats — 광장 상단 "이번 주" 통계. */
export function getPlazaStats(token: string): Promise<PlazaStats> {
  return apiRequest<PlazaStats>('/plaza/stats', { method: 'GET', token });
}

/**
 * GET /api/plaza/words/:word?offset=N — 정의 한 쪽(10개씩, 좋아요 많은 순).
 * offset 0(첫 쪽)에만 내 정의가 맨 위에 붙어 온다. offset은 "지금까지 받은 남의 정의 수".
 */
export function getPlazaWord(token: string, word: string, offset = 0): Promise<PlazaWordDetail> {
  return apiRequest<PlazaWordDetail>(`/plaza/words/${encodeURIComponent(word)}?offset=${offset}`, {
    method: 'GET',
    token,
  });
}

export type PlazaLikeResult = { liked: boolean; likeCount: number };

/** POST /api/plaza/definitions/:entryId/like — 좋아요 토글. */
export function toggleEntryLike(
  token: string,
  entryId: string,
): Promise<PlazaLikeResult> {
  return apiRequest<PlazaLikeResult>(`/plaza/definitions/${encodeURIComponent(entryId)}/like`, {
    method: 'POST',
    token,
  });
}

/** 신고 사유 — 서버 DTO의 @IsIn 목록과 같아야 한다. */
export type ReportReason = 'hate' | 'sexual' | 'violence' | 'spam' | 'other';

/**
 * POST /api/plaza/entries/:entryId/report — 정의 신고(204).
 * 같은 글을 두 번 신고해도 서버가 조용히 204를 준다(멱등) — 재시도를 겁낼 필요가 없다.
 */
export function reportEntry(
  token: string,
  entryId: string,
  reason: ReportReason,
): Promise<void> {
  return apiRequest<void>(`/plaza/entries/${encodeURIComponent(entryId)}/report`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

/** POST /api/plaza/users/:userId/block — 이 사람 글을 내 광장에서 치운다(204, 멱등). */
export function blockUser(token: string, userId: string): Promise<void> {
  return apiRequest<void>(`/plaza/users/${encodeURIComponent(userId)}/block`, {
    method: 'POST',
    token,
  });
}

/** DELETE /api/plaza/users/:userId/block — 차단 해제(204, 멱등). */
export function unblockUser(token: string, userId: string): Promise<void> {
  return apiRequest<void>(`/plaza/users/${encodeURIComponent(userId)}/block`, {
    method: 'DELETE',
    token,
  });
}

export type PlazaBlockedUser = { id: string; nickname: string };

/** GET /api/plaza/blocks — 내가 차단한 사람들(최근 차단 순). 해제하려면 목록이 필요하다. */
export function getBlockedUsers(token: string): Promise<PlazaBlockedUser[]> {
  return apiRequest<{ users: PlazaBlockedUser[] }>('/plaza/blocks', {
    method: 'GET',
    token,
  }).then((res) => res.users);
}
