/**
 * 연속 기록(streak) 계산 — 순수 함수만 둔다(React·저장소 의존 없음 → node로 바로 점검 가능).
 * 점검: node scripts/check-streak.mts (서버 back/scripts/check-record-streak.ts와 같은 사례)
 */

export function dayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** 방어권 간격 — 방어된 날끼리 최소 이만큼 떨어져야 한다(= 7일에 한 번). */
export const FREEZE_GAP_DAYS = 7;

/**
 * anchor(일 번호)에서 거꾸로 세는 연속 기록 + 방어된 빈 날. **서버(back/.../record-streak.ts)와 같은 규칙**이어야
 * 화면의 "연속 N일"과 서버의 연속 보너스가 어긋나지 않는다(바꾸면 양쪽을 같이 바꿀 것).
 *
 * 방어권(2026-11-15): 빈 날을 만나면 ① 그 전날은 썼고 ② 이미 방어한 날과 7일 이상 떨어져 있을 때만
 * 그 빈 날을 건너뛴다. 이틀 연속 비면 ①에서 끊긴다. 방어된 날은 숫자에 더하지 않는다. 자동 적용.
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

export type JournalStreak = {
  /** 오늘(또는 어제)까지 이어진 연속 기록일(방어권 포함). 끊겼으면 0. */
  currentStreak: number;
  /** 역대 최장 연속 기록일(같은 방어권 규칙). */
  longestStreak: number;
  /** 이번 주(월~오늘) 기록한 날 수. */
  daysThisWeek: number;
  /** 기록한 날의 총 개수(하루 여러 번 적어도 1일). */
  totalDays: number;
  /** 오늘 기록했나 — "오늘 한 줄로 이어 가요" 안내용. */
  writtenToday: boolean;
  /** 지금 이어지는 연속 안에서 방어권이 막아 준 날들(dayIndex). 달력 표시용. */
  frozenDays: number[];
  /** 방어권을 다시 쓸 수 있을 때까지 남은 일수. 0 = 지금 1개 있음. */
  freezeReadyInDays: number;
};

/**
 * 기록 '날짜'들로 streak 계산. 시각·중복은 무시(하루 여러 번 적어도 1일로 셈).
 * @param now 기준 시각(주입식 — 테스트/일관성).
 */
export function computeStreak(entries: { savedAt: string }[], now: Date): JournalStreak {
  const todayIdx = dayIndex(now);
  if (entries.length === 0) {
    return { currentStreak: 0, longestStreak: 0, daysThisWeek: 0, totalDays: 0, writtenToday: false, frozenDays: [], freezeReadyInDays: 0 };
  }
  const days = new Set<number>();
  for (const e of entries) days.add(dayIndex(new Date(e.savedAt)));

  // 현재 연속: 오늘 썼으면 오늘부터, 아니면 어제부터 센다(오늘은 아직 쓸 수 있다).
  // 어제가 비어도 그저께를 썼다면 방어권이 어제를 막아 연속이 살아 있다.
  const writtenToday = days.has(todayIdx);
  const { count: currentStreak, frozen: frozenDays } = streakWithFreeze(days, writtenToday ? todayIdx : todayIdx - 1);

  // 최장 연속: 기록한 날마다 거기서 끝나는 연속을 세어 최댓값(같은 규칙 그대로 — 단순·일관).
  let longestStreak = 0;
  for (const d of days) longestStreak = Math.max(longestStreak, streakWithFreeze(days, d).count);

  // 이번 주(월요일 시작) ~ 오늘.
  const weekStartIdx = todayIdx - ((now.getDay() + 6) % 7); // getDay: 0=일
  let daysThisWeek = 0;
  for (const d of days) if (d >= weekStartIdx && d <= todayIdx) daysThisWeek++;

  // 방어권은 가장 최근에 막은 날로부터 7일 뒤 다시 생긴다.
  const lastFrozen = frozenDays.length ? Math.max(...frozenDays) : null;
  const freezeReadyInDays = lastFrozen === null ? 0 : Math.max(0, FREEZE_GAP_DAYS - (todayIdx - lastFrozen));

  return { currentStreak, longestStreak, daysThisWeek, totalDays: days.size, writtenToday, frozenDays, freezeReadyInDays };
}

