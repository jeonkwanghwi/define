/**
 * PrismaPlazaRepository — PlazaRepository의 Prisma 구현.
 * groupBy로 단어별 정의 수, findMany+user include로 정의·닉네임 조회.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  PlazaDefinitionRow,
  PlazaRepository,
  PlazaWordCount,
} from './plaza.repository';

@Injectable()
export class PrismaPlazaRepository extends PlazaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listWordsWithCounts(): Promise<PlazaWordCount[]> {
    const groups = await this.prisma.entry.groupBy({
      by: ['word'],
      _count: { _all: true },
    });
    return groups
      .map((g) => ({ word: g.word, count: g._count._all }))
      // 정의 많은 순, 동수면 가나다
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'ko'));
  }

  async findDefinitionsByWord(
    word: string,
    userId: string,
  ): Promise<PlazaDefinitionRow[]> {
    const rows = await this.prisma.entry.findMany({
      where: { word },
      orderBy: { savedAt: 'desc' },
      include: {
        user: { select: { nickname: true } },
        _count: { select: { likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      nickname: r.user.nickname,
      text: r.text,
      savedAt: r.savedAt,
      likeCount: r._count.likes,
      likedByMe: r.likes.length > 0,
    }));
  }
}
