/**
 * 출석 적립 — 앱 열 때 1회 시도. 로그인 상태에서만, 비치명적(실패해도 throw X).
 * '오늘' 판정은 기기 로컬 날짜로 → 서버에 'YYYY-MM-DD' 전송.
 */
import { claimAttendance } from '@/services/currency-api';
import { useAuthStore } from '@/store/auth-store';

/** 기기 로컬 날짜를 'YYYY-MM-DD'로 (UTC 변환 없이 로컬 기준). */
export function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 로그인 상태면 출석 적립 1회 시도. 적립 성공 시 잔액 갱신 + claimed 반환(팝업용).
 * 비로그인/실패면 null.
 */
export async function runAttendanceClaim(): Promise<{ claimed: boolean; amount: number } | null> {
  const { token, setBalance } = useAuthStore.getState();
  if (!token) return null;
  try {
    const res = await claimAttendance(token, localDateString(new Date()));
    setBalance(res.balance);
    return { claimed: res.claimed, amount: res.amount };
  } catch (e) {
    console.warn('[attendance] 적립 실패(다음 오픈에 재시도):', e);
    return null;
  }
}
