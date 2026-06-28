/**
 * currency-api — 재화(잉크) 호출. 백엔드 계약(POST /api/currency/*)에 1:1.
 */
import { apiRequest } from './api-client';

export type AttendanceResult = { balance: number; claimed: boolean; amount: number };

/**
 * POST /api/currency/attendance — 출석 적립(하루 1회, 멱등).
 * localDate = 기기 로컬 날짜 'YYYY-MM-DD' (서버가 '오늘' 판정 기준으로 사용).
 */
export function claimAttendance(token: string, localDate: string): Promise<AttendanceResult> {
  return apiRequest<AttendanceResult>('/currency/attendance', {
    method: 'POST',
    token,
    body: { localDate },
  });
}
