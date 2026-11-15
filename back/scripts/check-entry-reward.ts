/**
 * 정의 보상(+3/개, 하루 5개) 점검 — **로컬 Postgres**에 임시 사용자를 만들어 실제 트랜잭션으로 확인한다.
 * 실행: `npx ts-node scripts/check-entry-reward.ts` (back/.env의 로컬 DB, dev.sh로 Postgres가 떠 있어야 함)
 */
import * as assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { PrismaCurrencyRepository } from '../src/modules/currency/currency.repository.prisma';
import { CurrencyService } from '../src/modules/currency/currency.service';

const prisma = new PrismaClient();

void (async () => {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) throw new Error('로컬 DB에서만 실행한다');
  const user = await prisma.user.create({ data: { email: `entry-check-${Date.now()}@local.test`, balance: 0 } });
  const svc = new CurrencyService(new PrismaCurrencyRepository(prisma as never));
  try {
    // 3개 → +9 (오늘 3/5)
    assert.deepEqual(await svc.grantEntryRewards(user.id, 3, '2026-11-15'), { amount: 9, countToday: 3, balance: 9 });
    // 4개 더 → 상한까지 2개만 +6 (5/5)
    assert.deepEqual(await svc.grantEntryRewards(user.id, 4, '2026-11-15'), { amount: 6, countToday: 5, balance: 15 });
    // 상한 이후 → 없음
    assert.equal(await svc.grantEntryRewards(user.id, 1, '2026-11-15'), null);
    // 새로 생긴 게 0(수정만) → 없음
    assert.equal(await svc.grantEntryRewards(user.id, 0, '2026-11-16'), null);
    // 다음 날 → 다시 0부터
    assert.deepEqual(await svc.grantEntryRewards(user.id, 1, '2026-11-16'), { amount: 3, countToday: 1, balance: 18 });
    // 동시에 두 번(각 5개) → 합쳐도 그날 5개를 넘지 않는다
    const [a, b] = await Promise.all([
      svc.grantEntryRewards(user.id, 5, '2026-11-17'),
      svc.grantEntryRewards(user.id, 5, '2026-11-17'),
    ]);
    assert.equal((a?.amount ?? 0) + (b?.amount ?? 0), 15);
    const end = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { balance: true, entryRewardCount: true } });
    assert.deepEqual(end, { balance: 33, entryRewardCount: 5 });
    console.log('ok');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
})();
