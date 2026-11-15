/**
 * 연속 기록 보너스 점검. 실행: `npx ts-node scripts/check-record-streak.ts`
 * ① 한국 날짜 경계 ② 방어권(주 1회 빈 날) ③ 마일스톤(40·50…일 +20)만 지급 ④ 같은 날 재지급 없음.
 */
import * as assert from 'node:assert/strict';

import { CurrencyService } from '../src/modules/currency/currency.service';
import { computeRecordStreak, kstDate } from '../src/modules/journal/record-streak';

const at = (iso: string) => new Date(iso); // ISO는 +09:00으로 적어 한국 시각임을 드러낸다

// ① 밤 11시와 다음 날 오전 8시(한국) = 서로 다른 날 → 2일 연속. (UTC로 셌다면 같은 날 → 1)
assert.equal(kstDate(at('2026-11-15T23:30:00+09:00')), '2026-11-15');
assert.equal(kstDate(at('2026-11-16T08:00:00+09:00')), '2026-11-16');
assert.equal(computeRecordStreak([at('2026-11-15T23:30:00+09:00'), at('2026-11-16T08:00:00+09:00')]), 2);
// 같은 날 여러 개는 1일, 하루 비면 끊긴다
assert.equal(computeRecordStreak([at('2026-11-16T08:00:00+09:00'), at('2026-11-16T21:00:00+09:00')]), 1);
// 방어권: 하루 빈 날은 막아 준다(13·15일 → 2, 빈 14일은 숫자에 안 더함)
const day = (dd: number) => at(`2026-11-${String(dd).padStart(2, '0')}T10:00:00+09:00`);
assert.equal(computeRecordStreak([day(13), day(15)]), 2);
// 이틀 연속 비면 끊긴다(12·15일 → 1)
assert.equal(computeRecordStreak([day(12), day(15)]), 1);
// 7일 안에 두 번째 빈 날은 못 막는다: 10,(11빈),12,13,(14빈),15 → 15·13·12까지 3 (11은 14와 3일 차이)
assert.equal(computeRecordStreak([day(10), day(12), day(13), day(15)]), 3);
// 7일 넘게 떨어진 빈 날은 둘 다 막는다: 1..20 중 5일·15일만 빔 → 18
assert.equal(
  computeRecordStreak(Array.from({ length: 20 }, (_, i) => i + 1).filter((d) => d !== 5 && d !== 15).map(day)),
  18,
);

// ②③ 가짜 저장소로 서비스 규칙 확인
const repo = { marker: null as string | null, balance: 0 };
const fake = {
  async grantRecord(_u: string, amount: number, today: string) {
    if (repo.marker !== null && repo.marker >= today) return { granted: false, balance: repo.balance };
    repo.marker = today;
    repo.balance += amount;
    return { granted: true, balance: repo.balance };
  },
};
const svc = new CurrencyService(fake as never);

void (async () => {
  // 1~30일째는 이제 연속 보너스가 없다(정의 1개당 +3이 대신한다)
  repo.marker = '2026-11-10';
  assert.equal(await svc.grantRecordMilestone('u', 1, true, '2026-11-15'), null);
  assert.equal(await svc.grantRecordMilestone('u', 30, true, '2026-11-16'), null);
  // 31~39일째도 0, 40일째 +20
  assert.equal(await svc.grantRecordMilestone('u', 35, true, '2026-12-20'), null);
  assert.deepEqual(await svc.grantRecordMilestone('u', 40, true, '2026-12-25'), { milestone: 40, amount: 20, balance: 20 });
  // 같은 날 다시 → 무지급, 오늘 기록 없음 → 무지급
  assert.equal(await svc.grantRecordMilestone('u', 40, true, '2026-12-25'), null);
  assert.equal(await svc.grantRecordMilestone('u', 50, false, '2027-01-04'), null);
  // 끊긴 뒤에도 다시 50일째가 되면 +20(예전엔 최고 기록 마커 때문에 막혔다)
  assert.equal((await svc.grantRecordMilestone('u', 50, true, '2027-03-01'))?.amount, 20);
  console.log('ok');
})();
