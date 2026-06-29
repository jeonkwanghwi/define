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

  async grantAttendance(userId: string, amount: number, localDate: string): Promise<number> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount }, lastAttendanceDate: localDate },
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

  async getLastRewardedStreakDay(userId: string): Promise<number> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastRewardedStreakDay: true },
    });
    return row?.lastRewardedStreakDay ?? 0;
  }

  async grantRecord(
    userId: string,
    amount: number,
    streak: number,
  ): Promise<{ granted: boolean; balance: number }> {
    // 마커가 streak보다 작은 행만 갱신 → 동시 import의 이중지급 방지.
    const res = await this.prisma.user.updateMany({
      where: { id: userId, lastRewardedStreakDay: { lt: streak } },
      data: { balance: { increment: amount }, lastRewardedStreakDay: streak },
    });
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    return { granted: res.count > 0, balance: row?.balance ?? 0 };
  }
}
