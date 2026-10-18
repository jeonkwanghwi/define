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
      // 광장과 같은 공개 규칙: 프로필을 마친 계정(plaza.repository.prisma.ts PROFILED),
      // 신고로 숨겨진 글 제외, 내가 차단한 사람 제외. 마을만 빠져 있으면 광장에서 치운 글이 여기로 샌다.
      where: {
        id: { not: excludeUserId },
        entries: { some: { hidden: false } },
        birthYear: { not: null },
        blocksReceived: { none: { blockerId: excludeUserId } },
      },
      // 마을은 30집 남짓을 섞어 앉힐 뿐이라 후보를 전부 읽을 필요가 없다.
      // ponytail: 상한 안쪽만 섞인다(DB가 주는 순서). 사용자가 수백 명을 넘으면 무작위 표본(TABLESAMPLE 등)으로.
      take: 200,
      select: {
        id: true,
        nickname: true,
        entries: {
          where: { hidden: false },
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
