import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AdRewardRepository, GrantOutcome } from './ad-reward.repository';

@Injectable()
export class PrismaAdRewardRepository extends AdRewardRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.prisma.adReward.count({ where: { userId, createdAt: { gte: since } } });
  }

  async grant(input: {
    transactionId: string;
    userId: string;
    amount: number;
    dailyLimit: number;
    since: Date;
  }): Promise<GrantOutcome> {
    const { transactionId, userId, amount, dailyLimit, since } = input;
    try {
      return await this.prisma.$transaction(
        async (tx): Promise<GrantOutcome> => {
          const used = await tx.adReward.count({
            where: { userId, createdAt: { gte: since } },
          });
          if (used >= dailyLimit) return 'limit';
          // 유니크(transactionId)가 중복 지급을 막는 자리다 — 먼저 읽고 판단하지 않는다.
          // 읽고 나서 쓰는 사이에 같은 콜백이 또 들어오면 둘 다 통과한다.
          await tx.adReward.create({ data: { transactionId, userId, amount } });
          await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: amount } },
          });
          return 'granted';
        },
        // Serializable: 위 count와 create 사이의 레이스까지 DB가 막는다. 충돌하면 한쪽이
        // 실패하고 500 → 구글이 재시도 → transactionId 유니크가 받아내므로 안전하다.
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 = transactionId 유니크 위반 → 이미 지급한 콜백.
        if (e.code === 'P2002') return 'duplicate';
        // P2003/P2025 = userId FK가 가리키는 사용자가 없다 → 탈퇴한 사용자.
        if (e.code === 'P2003' || e.code === 'P2025') return 'no-user';
      }
      throw e; // 그 밖의 DB 오류는 **우리 고장**이다. 숨기지 않고 500으로 올린다.
    }
  }
}
