/**
 * feedback-api — 버그 제보 호출. 백엔드 계약(POST /api/feedback)에 1:1.
 * 로그인 토큰이 필수다 — 인증 없는 메일 발송 엔드포인트는 스팸 통로가 되므로 서버가 막는다.
 */
import { apiRequest } from './api-client';

/** 기기·버전 메타. 못 알아내면 빼고 보낸다 — 서버가 optional로 받는다. */
export type FeedbackMeta = {
  appVersion?: string;
  platform?: string;
  osVersion?: string;
  deviceModel?: string;
};

/**
 * POST /api/feedback — 제보를 운영자 메일로 보낸다.
 * 204(본문 없음)라 돌려줄 게 없다. 429 = 쿨다운(30초), 400 = 길이 위반.
 */
export function sendFeedback(
  token: string,
  input: { title: string; body: string } & FeedbackMeta,
): Promise<void> {
  return apiRequest<void>('/feedback', { method: 'POST', token, body: input });
}
