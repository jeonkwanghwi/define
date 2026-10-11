/**
 * ads-api — 보상형 광고 쿼터 조회. 백엔드 계약(GET /api/ads/quota)에 1:1.
 *
 * **적립 API는 없다.** 잉크는 구글이 우리 서버로 직접 거는 SSV 콜백으로만 들어온다 —
 * 앱이 "광고 다 봤어요"라고 말해서 적립되는 경로는 애초에 만들지 않았다(조작이 자명하다).
 * 그래서 앱이 서버에 할 수 있는 말은 "오늘 몇 번 남았나요?" 하나뿐이다.
 */
import { apiRequest } from './api-client';

/** remaining=오늘 남은 횟수, limit=하루 상한, amount=1회 보상 잉크. 셋 다 서버가 정한다. */
export type AdQuota = { remaining: number; limit: number; amount: number };

/** GET /api/ads/quota — JWT 필수. */
export function getAdQuota(token: string): Promise<AdQuota> {
  return apiRequest<AdQuota>('/ads/quota', { method: 'GET', token });
}
