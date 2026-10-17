/**
 * 단어 검색 매칭(matchWord) 검증 — 초성·조합 중 글자는 눈으로 확인하기 어려워 assert로 고정.
 *
 * 실행: node --experimental-strip-types scripts/check-hangul-search.mjs
 */
import assert from 'node:assert/strict';
import { matchWord } from '../src/lib/korean.ts';

const hit = (w, q) => matchWord(w, q) !== null;

// 부분 문자열 + 대소문자
assert.deepEqual(matchWord('첫사랑', '사랑'), { start: 1, end: 3 });
assert.deepEqual(matchWord('Love', 'lo'), { start: 0, end: 2 });
assert.deepEqual(matchWord('사랑', ''), { start: 0, end: 0 });
assert.ok(!hit('사랑', '시간'));

// 초성
assert.deepEqual(matchWord('사랑', 'ㅅㄹ'), { start: 0, end: 2 });
assert.ok(hit('시간', 'ㅅ') && hit('사랑', 'ㅅ'));
assert.deepEqual(matchWord('첫사랑', 'ㅅㄹ'), { start: 1, end: 3 });
assert.ok(hit('시간', 'ㅅㄱ') && !hit('사랑', 'ㅅㄱ'));

// 조합 중인 마지막 글자
assert.deepEqual(matchWord('사랑', '사ㄹ'), { start: 0, end: 2 });
assert.deepEqual(matchWord('사랑', '살'), { start: 0, end: 2 }); // IME가 ㄹ을 받침으로 붙인 순간
assert.ok(hit('시간', '싴') === false);
assert.ok(hit('시간', '시ㄱ') && hit('시간', '식'));
assert.ok(!hit('사랑', 'ㄹ사')); // 섞인 순서는 안 맞음
assert.ok(!hit('사', '사ㄹ')); // 다음 글자가 없으면 불일치

console.log('check-hangul-search: all passed');
