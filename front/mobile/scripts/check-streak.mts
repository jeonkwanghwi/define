/**
 * 앱 연속 기록 계산 점검. 실행: node scripts/check-streak.mts
 * 서버 back/scripts/check-record-streak.ts와 같은 사례 — 두 쪽 규칙이 같아야 화면 숫자와 보상이 맞는다.
 */
import assert from 'node:assert/strict';

const { computeStreak } = await import('../src/lib/streak.ts');

// 기기 시간대 기준 날짜 — 테스트는 그 날 정오로 만든다(시간대와 무관하게 같은 날).
const day = (dd: number) => ({ savedAt: new Date(2026, 10, dd, 12).toISOString() });
const now = (dd: number, h = 15) => new Date(2026, 10, dd, h);
const s = (days: number[], today: number) => computeStreak(days.map(day), now(today));

assert.equal(s([13, 15], 15).currentStreak, 2); // 하루 빈 날 방어
assert.equal(s([12, 15], 15).currentStreak, 1); // 이틀 연속 빔 → 끊김
assert.equal(s([10, 12, 13, 15], 15).currentStreak, 3); // 7일 안 두 번째 빈 날은 못 막음
const all = Array.from({ length: 20 }, (_, i) => i + 1).filter((d) => d !== 5 && d !== 15);
assert.equal(s(all, 20).currentStreak, 18); // 7일 넘게 떨어진 빈 날은 둘 다 막음

// 오늘 아직 안 썼어도 어제까지 이어졌으면 살아 있음
const r = s([13, 14], 15);
assert.equal(r.currentStreak, 2);
assert.equal(r.writtenToday, false);
// 어제가 비고 그저께 썼으면 방어권이 어제를 막아 살아 있고, 방어권은 6일 뒤 다시 생김
const f = s([12, 13], 15);
assert.equal(f.currentStreak, 2);
assert.equal(f.frozenDays.length, 1);
assert.equal(f.freezeReadyInDays, 6);
// 방어권 안 쓴 상태 = 지금 1개 있음
assert.equal(s([14, 15], 15).freezeReadyInDays, 0);
// 최장 기록은 지난 런도 본다
assert.equal(s([1, 2, 3, 4, 10], 15).longestStreak, 4);
assert.equal(s([], 15).currentStreak, 0);

console.log('ok');
