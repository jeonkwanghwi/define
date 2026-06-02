/**
 * 날짜 포맷 유틸 — 표시용 문자열 + 비교 헬퍼.
 *
 * 원본: design-source/app/screens-main.jsx의 formatKoreanDate / isSameDay.
 * journal-store가 절대 날짜(formatYmd)와 상대 라벨(formatRelativeLabel)을 함께 사용.
 *
 * 모두 순수 함수 — 시간대는 기기 로컬 기준(getMonth/getDate 등).
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 같은 '날'인지 (연·월·일 일치). 시각은 무시. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 메인 날짜 칩용 — "6월 2일 월요일".
 * design-source와 1:1 (요일까지 표기).
 */
export function formatKoreanDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

/** 타임라인 절대 날짜 — 'YYYY.MM.DD' (WordEntry.date 포맷). */
export function formatYmd(d: Date): string {
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/** 자정 기준 타임스탬프 — 달력상 '며칠 차이'를 시각 영향 없이 계산하기 위함. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * 타임라인 상대 라벨 — '오늘 / 어제 / N일 전 / 지난달 / N달 전 / 작년 / N년 전'.
 *
 * 최근은 '일' 단위, 그 이상은 '달' 단위, 1년 이상은 '년' 단위로 자연스럽게 승급.
 * @param date 기록 시각
 * @param now  기준 시각(보통 현재). 테스트/일관성 위해 주입식.
 */
export function formatRelativeLabel(date: Date, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';

  const monthsDiff =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

  if (monthsDiff >= 24) return `${Math.floor(monthsDiff / 12)}년 전`;
  if (monthsDiff >= 12) return '작년';
  if (monthsDiff >= 2) return `${monthsDiff}달 전`;
  if (monthsDiff === 1) return '지난달';
  return `${days}일 전`;
}
