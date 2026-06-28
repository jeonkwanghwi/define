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
}
