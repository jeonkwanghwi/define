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

type WordedEntry = { word: string; savedAt: string };
export type QuestionTarget = {
  label: string;
  periodStart: string;
  periodEnd: string;
  focusWord: string;
};

/**
 * 질문모드용 랜덤 대상 — 기록 있는 연도 중 하나 + 그 해의 단어 하나. 기록 없으면 null.
 * rng는 테스트 주입용(기본 Math.random).
 */
export function pickRandomQuestionTarget(
  entries: WordedEntry[],
  rng: () => number = Math.random,
): QuestionTarget | null {
  if (entries.length === 0) return null;
  const years = availableYears(entries);
  const year = years[Math.floor(rng() * years.length)];
  const inYear = entries.filter((e) => yearOf(e.savedAt) === year);
  const focusWord = inYear[Math.floor(rng() * inYear.length)].word;
  return { label: `${year}년의 나`, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, focusWord };
}
