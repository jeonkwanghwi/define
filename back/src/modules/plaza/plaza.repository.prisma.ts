/**
 * PrismaPlazaRepository — PlazaRepository의 Prisma 구현.
 * 단어별 집계는 SQL이 한다(GROUP BY + 윈도우 함수) — 전체 정의를 끌어와 JS에서 묶으면
 * 데이터가 늘수록 선형으로 느려진다. 윈도우 함수는 Prisma가 지원하지 않아 그 부분만 $queryRaw다.
 * 한 단어의 정의 목록·좋아요 토글은 그대로 Prisma 쿼리.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  PlazaDefinitionRow,
  PlazaPreviewRow,
  PlazaRepository,
  PlazaStatsRow,
  PlazaWordCount,
} from './plaza.repository';

@Injectable()
export class PrismaPlazaRepository extends PlazaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listWordsWithCounts(limit: number): Promise<PlazaWordCount[]> {
    // ① 단어별 집계 → 활동순 상위 N. 정렬은 기존 JS와 같다: 마지막 정의 추가가 위로,
    //    동률이면 정의 많은 순. 상한이 있어야 단어가 늘어도 전송량이 고정된다.
    const words = await this.prisma.$queryRaw<
      { word: string; count: number; lastActivityAt: Date }[]
    >`
      SELECT word, COUNT(*)::int AS count, MAX("savedAt") AS "lastActivityAt"
      FROM entries
      GROUP BY word
      ORDER BY MAX("savedAt") DESC, COUNT(*) DESC
      LIMIT ${limit}
    `;
    if (words.length === 0) return [];

    // ② ①이 고른 단어들의 미리보기만 뽑는다. 단어별 상위 2개를 한 번에 고르려면
    //    ROW_NUMBER가 필요하고 Prisma가 윈도우 함수를 지원하지 않아 여기만 raw다.
    //    순위는 기존과 같다: 좋아요 desc → 동률 최신순(savedAt desc).
    //    word는 사용자 입력이라 문자열로 끼워 넣지 않고 배열 하나를 바인딩한다.
    //    바깥의 ORDER BY rn은 previews[0]이 1위가 되도록 — 안 적으면 순서가 보장되지 않는다.
    const wordList = words.map((w) => w.word);
    const previewRows = await this.prisma.$queryRaw<
      (PlazaPreviewRow & { word: string })[]
    >`
      SELECT id, word, nickname, text, "likeCount" FROM (
        SELECT e.id, e.word, u.nickname, e.text,
               COUNT(l.id)::int AS "likeCount",
               ROW_NUMBER() OVER (
                 PARTITION BY e.word
                 ORDER BY COUNT(l.id) DESC, e."savedAt" DESC
               ) AS rn
        FROM entries e
        JOIN users u ON u.id = e."userId"
        LEFT JOIN likes l ON l."entryId" = e.id
        WHERE e.word = ANY(${wordList})
        GROUP BY e.id, e.word, u.nickname, e.text, e."savedAt"
      ) t
      WHERE rn <= 2
      ORDER BY rn
    `;

    const previewsByWord = new Map<string, PlazaPreviewRow[]>();
    for (const r of previewRows) {
      const preview = {
        id: r.id,
        nickname: r.nickname,
        text: r.text,
        likeCount: r.likeCount,
      };
      const bucket = previewsByWord.get(r.word);
      if (bucket) bucket.push(preview);
      else previewsByWord.set(r.word, [preview]);
    }

    // 순서는 ①이 정한 그대로. ②의 반환 순서는 단어 간 순위와 무관하다.
    return words.map((w) => ({
      word: w.word,
      count: w.count,
      previews: previewsByWord.get(w.word) ?? [],
      lastActivityAt: w.lastActivityAt,
    }));
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

    // 단어별 1위만 필요하니 DB가 집계해서 1행씩 준다. 전체 정의를 끌어와 JS에서 묶으면
    // 광장 입장마다(words + stats 동시 호출) 테이블을 두 번 통째로 읽는다.
    // 동률이면 어느 단어가 뽑히는지는 임의다 — 기존 JS 루프도 Map 순회 순서에 기댔다(표시용 통계).
    //
    // 좋아요 1위: INNER JOIN이라 좋아요 0인 단어는 애초에 빠진다(기존 likeCount > 0 조건과 같다).
    const topLiked = await this.prisma.$queryRaw<{ word: string; likeCount: number }[]>`
      SELECT e.word, COUNT(l.id)::int AS "likeCount"
      FROM entries e JOIN likes l ON l."entryId" = e.id
      GROUP BY e.word ORDER BY COUNT(l.id) DESC LIMIT 1
    `;
    const mostDefined = await this.prisma.$queryRaw<{ word: string; count: number }[]>`
      SELECT word, COUNT(*)::int AS count
      FROM entries GROUP BY word ORDER BY COUNT(*) DESC LIMIT 1
    `;
    const topLikedWord = topLiked[0] ?? null;
    const mostDefinedWord = mostDefined[0] ?? null;

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
