import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { BalanceState, CurrencyRepository } from './currency.repository';

@Injectable()
export class PrismaCurrencyRepository extends CurrencyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findState(userId: string): Promise<BalanceState | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, lastAttendanceDate: true },
    });
    return row ? { balance: row.balance, lastAttendanceDate: row.lastAttendanceDate } : null;
  }

  async grantAttendance(
    userId: string,
    amount: number,
    localDate: string,
  ): Promise<{ granted: boolean; balance: number }> {
    // "아직 오늘 안 받았으면"을 UPDATE 조건에 넣는다 — 읽고 나서 따로 쓰면 동시 요청이 모두 통과한다.
    // YYYY-MM-DD 문자열은 lt 비교 = 날짜 비교.
    const res = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastAttendanceDate: null }, { lastAttendanceDate: { lt: localDate } }],
      },
      data: { balance: { increment: amount }, lastAttendanceDate: localDate },
    });
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    return { granted: res.count > 0, balance: row?.balance ?? 0 };
  }

  async refund(userId: string, amount: number): Promise<number> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    return row.balance;
  }

  async spend(userId: string, cost: number): Promise<{ ok: boolean; balance: number }> {
    // 원자적 조건부 차감: balance >= cost 인 행만 갱신 → 동시성에도 음수/이중차감 없음.
    const res = await this.prisma.user.updateMany({
      where: { id: userId, balance: { gte: cost } },
      data: { balance: { decrement: cost } },
    });
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    return { ok: res.count > 0, balance: row?.balance ?? 0 };
  }

  async grantEntryRewards(
    userId: string,
    newEntries: number,
    today: string,
    perEntry: number,
    cap: number,
  ): Promise<{ amount: number; countToday: number; balance: number }> {
    // 읽고-계산하고-쓰기를 Serializable 트랜잭션으로 — 동시 동기화 두 건이 같은 "남은 개수"를 보고
    // 상한을 넘겨 주는 일을 막는다(광고 보상과 같은 방식). 충돌(P2034)이면 한 번 다시 한다.
    const run = () =>
      this.prisma.$transaction(
        async (tx) => {
          const u = await tx.user.findUnique({
            where: { id: userId },
            select: { entryRewardDate: true, entryRewardCount: true, balance: true },
          });
          if (!u) return { amount: 0, countToday: 0, balance: 0 };
          const used = u.entryRewardDate === today ? u.entryRewardCount : 0;
          const give = Math.max(0, Math.min(newEntries, cap - used));
          if (give === 0) return { amount: 0, countToday: used, balance: u.balance };
          const updated = await tx.user.update({
            where: { id: userId },
            data: { entryRewardDate: today, entryRewardCount: used + give, balance: { increment: give * perEntry } },
            select: { balance: true },
          });
          return { amount: give * perEntry, countToday: used + give, balance: updated.balance };
        },
        { isolationLevel: 'Serializable' },
      );
    try {
      return await run();
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2034') throw e;
      return run();
    }
  }

  async grantRecord(
    userId: string,
    amount: number,
    today: string,
  ): Promise<{ granted: boolean; balance: number }> {
    // 오늘 마커가 아닌 행만 갱신 → 동시 import의 이중지급 방지('YYYY-MM-DD'라 lt가 곧 이전 날짜).
    const res = await this.prisma.user.updateMany({
      where: { id: userId, OR: [{ lastRecordRewardDate: null }, { lastRecordRewardDate: { lt: today } }] },
      data: { balance: { increment: amount }, lastRecordRewardDate: today },
    });
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    return { granted: res.count > 0, balance: row?.balance ?? 0 };
  }
}
