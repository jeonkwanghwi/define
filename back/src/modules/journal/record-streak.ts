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

/** 방어권 간격 — 방어된 날끼리 최소 이만큼 떨어져야 한다(= 7일에 한 번). */
export const FREEZE_GAP_DAYS = 7;

/**
 * streakWithFreeze — anchor(일 번호)에서 거꾸로 세는 연속 기록. **앱의 journal-store와 같은 규칙**이어야
 * 화면의 "연속 N일"과 서버 보상이 어긋나지 않는다(바꾸면 양쪽을 같이 바꿀 것).
 *
 * 방어권(2026-11-15, 사용자 결정): 빈 날을 만나면 ① 그 전날은 썼고 ② 이미 방어한 날과 7일 이상
 * 떨어져 있을 때만 그 빈 날을 건너뛴다. 이틀 연속 비면 ①에서 끊긴다. 방어된 날은 숫자에 더하지 않는다.
 * 자동 적용 — 사용자가 누를 것은 없다.
 */
export function streakWithFreeze(days: Set<number>, anchor: number): { count: number; frozen: number[] } {
  let count = 0;
  const frozen: number[] = [];
  for (let d = anchor; ; d--) {
    if (days.has(d)) {
      count++;
      continue;
    }
    const canFreeze = days.has(d - 1) && frozen.every((f) => f - d >= FREEZE_GAP_DAYS);
    if (!canFreeze) break;
    frozen.push(d);
  }
  return { count, frozen };
}

/**
 * computeRecordStreak — 가장 최근 기록일에서 끝나는 연속 기록 수(한국 날짜·방어권 포함). 순수 함수.
 * 같은 날 여러 개는 1일. 빈 배열 → 0.
 */
export function computeRecordStreak(createdAt: Date[]): number {
  if (createdAt.length === 0) return 0;
  const days = new Set(createdAt.map(kstDayNumber));
  return streakWithFreeze(days, Math.max(...days)).count;
}
