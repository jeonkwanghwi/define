/**
 * recall-api — tab3 회상 호출. 백엔드 계약(POST /api/recall/*)에 1:1.
 * 키·프롬프트는 서버에만. 대화는 stateless라 매 요청 messages[]를 클라가 보낸다.
 */
import { apiRequest } from './api-client';

export type RecallFilter = { age?: number; periodStart?: string; periodEnd?: string };
export type RecallMessage = { role: 'user' | 'assistant'; content: string };
export type RecallChatResult = { message: string; balance: number; conversationToken: string };

/** POST /api/recall/consent — AI 데이터 동의 기록(1회). */
export function recallConsent(token: string): Promise<{ recallConsentAt: string }> {
  return apiRequest<{ recallConsentAt: string }>('/recall/consent', {
    method: 'POST',
    token,
  });
}

/** POST /api/recall/chat — 과거의 나와 1턴. 이어하기면 conversationToken 첨부(무료), 없으면 새 대화(30잉크 차감). */
export function recallChat(
  token: string,
  body: {
    filter: RecallFilter;
    messages: RecallMessage[];
    conversationToken?: string;
    mode?: 'free' | 'question';
    focusWord?: string;
  },
): Promise<RecallChatResult> {
  return apiRequest<RecallChatResult>('/recall/chat', {
    method: 'POST',
    token,
    body,
  });
}
