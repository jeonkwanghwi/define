/**
 * recall-range — 로컬 엔트리로 "어느 시절의 나" 필터 선택지를 계산. 순수 함수(검증 대상).
 * 나이 = savedAt 연도 − birthYear. 데이터에 없는 나이/연도는 노출 안 함(빈 슬라이스 방지).
 */
type DatedEntry = { savedAt: string };

function yearOf(iso: string): number {
  return new Date(iso).getFullYear();
}

/** 기록에 존재하는 나이들(오름차순, 유니크). birthYear 없으면 빈 배열. 음수 나이는 제외. */
export function availableAges(entries: DatedEntry[], birthYear: number | null): number[] {
  if (birthYear == null) return [];
  const set = new Set<number>();
  for (const e of entries) {
    const age = yearOf(e.savedAt) - birthYear;
    if (age >= 0) set.add(age);
  }
  return [...set].sort((a, b) => a - b);
}

/** 기록에 존재하는 연도들(내림차순, 유니크). */
export function availableYears(entries: DatedEntry[]): number[] {
  const set = new Set<number>();
  for (const e of entries) set.add(yearOf(e.savedAt));
  return [...set].sort((a, b) => b - a);
}

/** 특정 나이의 기록 수. */
export function countForAge(
  entries: DatedEntry[],
  birthYear: number | null,
  age: number,
): number {
  if (birthYear == null) return 0;
  return entries.filter((e) => yearOf(e.savedAt) - birthYear === age).length;
}

/** 특정 연도의 기록 수. */
export function countForYear(entries: DatedEntry[], year: number): number {
  return entries.filter((e) => yearOf(e.savedAt) === year).length;
}
