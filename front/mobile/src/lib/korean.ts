/**
 * 한국어 조사 유틸.
 *
 * 한글 음절(가~힣)은 유니코드에서 (초성 × 21 + 중성) × 28 + 종성 순으로
 * 배열되어 있어, (code - 0xAC00) % 28 이 0이면 받침(종성)이 없는 글자다.
 *
 * 사용: `나에게 ${word}${topicSuffix(word)}…`  →  "사랑이란" / "용기란"
 */

/**
 * '이란' / '란' 선택 — 마지막 글자의 받침 유무로 판단.
 * 마지막 글자가 한글 음절이 아니면(영문 커스텀 단어 등) 기존 동작('이란')을 유지한다.
 */
export function topicSuffix(word: string): '이란' | '란' {
  const last = word[word.length - 1];
  if (!last) return '이란';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '이란';
  return (code - 0xac00) % 28 > 0 ? '이란' : '란';
}

/**
 * '으로' / '로' 선택 — 받침이 있으면 '으로', 없거나 ㄹ받침이면 '로'(예: 호박으로, 코발트로, 연필로).
 * 한글 음절이 아니면 '로'.
 */
export function toSuffix(word: string): '으로' | '로' {
  const last = word[word.length - 1];
  if (!last) return '로';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '로';
  const jong = (code - 0xac00) % 28; // 8 = ㄹ
  return jong === 0 || jong === 8 ? '로' : '으로';
}

// ─── 단어 검색 (초성·입력 중인 글자 포함) ───

// 초성 19개 / 종성 28개(0 = 받침 없음)를 "호환 자모"(ㄱ U+3131~)로 적은 표.
// 음절 코드 = 0xAC00 + (초성 × 21 + 중성) × 28 + 종성 이라, 나눗셈으로 꺼낼 수 있다.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

const isSyllable = (c: number) => c >= 0xac00 && c <= 0xd7a3;
// 자음 자모만(ㄱ~ㅎ). 모음(ㅏ~)은 초성 검색 대상이 아니다.
const isConsonantJamo = (ch: string) => ch >= 'ㄱ' && ch <= 'ㅎ';

/** 글자의 초성. 한글 음절이 아니면 그 글자 그대로(영문 단어도 초성 문자열 길이가 같게). */
function choOf(ch: string): string {
  const c = ch.charCodeAt(0);
  return isSyllable(c) ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
}

/** 단어 안에서 찾은 구간 [start, end) — 하이라이트용. */
export type MatchRange = { start: number; end: number };

/**
 * 검색어가 단어에 맞으면 맞은 구간을, 아니면 null.
 *
 * 한 글자 칠 때마다(IME 조합 중에도) 불리므로 세 경우를 본다:
 *   1. 그냥 부분 문자열        — "사랑" → "첫사랑" (대소문자 무시)
 *   2. 자음만 친 초성 검색      — "ㅅㄹ" → "사랑"
 *   3. 마지막 글자가 아직 조합 중 — "사ㄹ" 또는 "살"(ㄹ이 받침으로 붙은 상태) → "사랑"
 * 빈 검색어는 { 0, 0 } — "전부 맞음, 칠할 곳 없음".
 */
export function matchWord(word: string, query: string): MatchRange | null {
  const q = query.trim().toLowerCase();
  if (!q) return { start: 0, end: 0 };
  const w = word.toLowerCase();

  // 1. 부분 문자열
  const i = w.indexOf(q);
  if (i >= 0) return { start: i, end: i + q.length };

  // 2. 초성 검색 — 단어를 초성 문자열로 바꿔 비교. 글자 수가 같아서 위치도 그대로 쓴다.
  if ([...q].every(isConsonantJamo)) {
    const j = [...w].map(choOf).join('').indexOf(q);
    return j >= 0 ? { start: j, end: j + q.length } : null;
  }

  // 3. 조합 중인 마지막 글자 → (앞부분, 다음 글자 초성이어야 할 자음)으로 나눈다.
  const last = q[q.length - 1];
  const lc = last.charCodeAt(0);
  let head: string;
  let nextCho: string;
  if (isConsonantJamo(last)) {
    head = q.slice(0, -1); // "사ㄹ" → "사" + ㄹ
    nextCho = last;
  } else if (isSyllable(lc) && (lc - 0xac00) % 28 > 0) {
    // "살" → "사" + ㄹ. 받침을 떼면 다음 글자의 초성일 수 있다(겹받침은 초성이 될 수 없어 자연히 불일치).
    const jong = (lc - 0xac00) % 28;
    head = q.slice(0, -1) + String.fromCharCode(lc - jong);
    nextCho = JONG[jong];
  } else {
    return null;
  }
  if (!head) return null;
  for (let k = w.indexOf(head); k >= 0; k = w.indexOf(head, k + 1)) {
    const next = w[k + head.length];
    if (next && choOf(next) === nextCho) return { start: k, end: k + head.length + 1 };
  }
  return null;
}
