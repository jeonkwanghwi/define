/**
 * PrismaPlazaRepository — PlazaRepository의 Prisma 구현.
 * groupBy로 단어별 정의 수, findMany+user include로 정의·닉네임 조회.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  PlazaDefinitionRow,
  PlazaRepository,
  PlazaStatsRow,
  PlazaWordCount,
} from './plaza.repository';

@Injectable()
export class PrismaPlazaRepository extends PlazaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listWordsWithCounts(): Promise<PlazaWordCount[]> {
    const entries = await this.prisma.entry.findMany({
      select: {
        id: true,
        word: true,
        text: true,
        savedAt: true,
        user: { select: { nickname: true } },
        _count: { select: { likes: true } },
      },
    });
    type Row = (typeof entries)[number];

    const byWord = new Map<string, Row[]>();
    for (const e of entries) {
      const bucket = byWord.get(e.word);
      if (bucket) bucket.push(e);
      else byWord.set(e.word, [e]);
    }

    const result: PlazaWordCount[] = [];
    for (const [word, list] of byWord) {
      // 추천순(좋아요 desc) → 동률 최신순(savedAt desc)
      const ranked = [...list].sort(
        (a, b) =>
          b._count.likes - a._count.likes || b.savedAt.getTime() - a.savedAt.getTime(),
      );
      const previews = ranked.slice(0, 2).map((e) => ({
        id: e.id,
        nickname: e.user.nickname,
        text: e.text,
        likeCount: e._count.likes,
      }));
      const lastActivityAt = list.reduce(
        (max, e) => (e.savedAt > max ? e.savedAt : max),
        list[0].savedAt,
      );
      result.push({ word, count: list.length, previews, lastActivityAt });
    }

    // 활동순 — 최근 정의 추가가 위로, 동률이면 정의 많은 순.
    result.sort(
      (a, b) =>
        b.lastActivityAt.getTime() - a.lastActivityAt.getTime() || b.count - a.count,
    );
    return result;
  }

  async getStats(userId: string, since: Date): Promise<PlazaStatsRow> {
    const weekDefinitions = await this.prisma.entry.count({
      where: { createdAt: { gte: since } },
    });

    const contributorGroups = await this.prisma.entry.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
    });
    const weekContributors = contributorGroups.length;

    const myWeekLikesReceived = await this.prisma.like.count({
      where: { createdAt: { gte: since }, entry: { userId } },
    });

    // 단어별 총 좋아요 / 정의 수 집계.
    const wordAgg = await this.prisma.entry.findMany({
      select: { word: true, _count: { select: { likes: true } } },
    });
    const likeByWord = new Map<string, number>();
    const countByWord = new Map<string, number>();
    for (const e of wordAgg) {
      likeByWord.set(e.word, (likeByWord.get(e.word) ?? 0) + e._count.likes);
      countByWord.set(e.word, (countByWord.get(e.word) ?? 0) + 1);
    }

    let topLikedWord: { word: string; likeCount: number } | null = null;
    for (const [word, likeCount] of likeByWord) {
      if (likeCount > 0 && (topLikedWord === null || likeCount > topLikedWord.likeCount)) {
        topLikedWord = { word, likeCount };
      }
    }

    let mostDefinedWord: { word: string; count: number } | null = null;
    for (const [word, count] of countByWord) {
      if (mostDefinedWord === null || count > mostDefinedWord.count) {
        mostDefinedWord = { word, count };
      }
    }

    return {
      weekDefinitions,
      weekContributors,
      myWeekLikesReceived,
      topLikedWord,
      mostDefinedWord,
    };
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

  async getEntryOwner(entryId: string): Promise<string | null> {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });
    return entry?.userId ?? null;
  }

  async toggleLike(
    userId: string,
    entryId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const existing = await this.prisma.like.findUnique({
      where: { userId_entryId: { userId, entryId } },
    });
    if (existing) {
      await this.prisma.like.deleteMany({ where: { userId, entryId } });
    } else {
      await this.prisma.like.upsert({
        where: { userId_entryId: { userId, entryId } },
        create: { userId, entryId },
        update: {},
      });
    }
    const likeCount = await this.prisma.like.count({ where: { entryId } });
    return { liked: existing === null, likeCount };
  }
}
