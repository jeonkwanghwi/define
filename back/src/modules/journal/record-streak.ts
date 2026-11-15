/**
 * 연속 기록일 계산 — **한국 시간(KST, UTC+9) 자정** 기준 날짜로 센다.
 *
 * 예전엔 UTC 날짜로 셌다 → 날짜가 한국 시간 오전 9시에 바뀌어, 밤 11시와 다음 날 오전 8시에
 * 쓴 기록이 "같은 날"로 묶였다(2026-11-15 수정). 사용자는 한국에 있으니 한국 달력으로 센다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 그 순간의 한국 날짜 'YYYY-MM-DD'. 보상 마커(lastRecordRewardDate)도 이 모양이라 문자열 비교가 곧 날짜 비교다. */
export function kstDate(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 한국 날짜의 일 번호(정수) — 이웃한 날짜는 1 차이. */
function kstDayNumber(d: Date): number {
  return Math.floor((d.getTime() + KST_OFFSET_MS) / DAY_MS);
}

/**
 * computeRecordStreak — "가장 최근 기록일에서 끝나는 연속 런"의 길이(한국 날짜 기준). 순수 함수.
 * 같은 날 여러 개는 1일. 빈 배열 → 0.
 */
export function computeRecordStreak(createdAt: Date[]): number {
  if (createdAt.length === 0) return 0;
  const days = new Set(createdAt.map(kstDayNumber));
  const latest = Math.max(...days);
  let streak = 0;
  while (days.has(latest - streak)) streak++;
  return streak;
}
