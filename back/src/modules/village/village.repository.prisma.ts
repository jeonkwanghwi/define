/**
 * PrismaVillageRepository — VillageRepository의 Prisma 구현.
 * entries: { some: {} } = 정의가 1개 이상인 유저만. 중첩 take로 유저별 최신 N개.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { VillageNeighborRow, VillageRepository } from './village.repository';

@Injectable()
export class PrismaVillageRepository extends VillageRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findNeighborCandidates(
    excludeUserId: string,
    wordsPerUser: number,
  ): Promise<VillageNeighborRow[]> {
    const users = await this.prisma.user.findMany({
      // 프로필을 마친 계정만 이웃으로(광장과 같은 공개 규칙 — plaza.repository.prisma.ts PROFILED)
      where: { id: { not: excludeUserId }, entries: { some: {} }, birthYear: { not: null } },
      select: {
        id: true,
        nickname: true,
        entries: {
          orderBy: { savedAt: 'desc' },
          take: wordsPerUser,
          select: { word: true, text: true, savedAt: true },
        },
      },
    });
    return users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      words: u.entries,
    }));
  }
}
