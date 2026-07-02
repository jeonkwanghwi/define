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
