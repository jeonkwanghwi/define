/**
 * PrismaPlazaRepository — PlazaRepository의 Prisma 구현.
 * 단어별 집계는 SQL이 한다(GROUP BY + 윈도우 함수) — 전체 정의를 끌어와 JS에서 묶으면
 * 데이터가 늘수록 선형으로 느려진다. 윈도우 함수는 Prisma가 지원하지 않아 그 부분만 $queryRaw다.
 * 한 단어의 정의 목록·좋아요 토글은 그대로 Prisma 쿼리.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  PlazaBlockedUserRow,
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

  async listWordsWithCounts(limit: number, userId?: string): Promise<PlazaWordCount[]> {
    // 중재 조건. 두 쿼리에 똑같이 끼워 넣는다 — 집계(①)에서 빼지 않으면
    // "정의 3개"라고 적고 미리보기·상세엔 2개만 보이는 모순이 생긴다.
    // userId가 없으면(비로그인) Prisma.empty로 조건 자체가 사라진다. 값은 전부 바인딩.
    const notBlocked = userId
      ? Prisma.sql`AND e."userId" NOT IN (
          SELECT "blockedId" FROM blocks WHERE "blockerId" = ${userId}
        )`
      : Prisma.empty;
    // 비로그인이면 null — `= NULL`은 참이 되지 않으니 myCount 0, isMine false로 자연히 떨어진다.
    const me = userId ?? null;

    // ① 단어별 집계 → 활동순 상위 N. 정렬은 기존 JS와 같다: 마지막 정의 추가가 위로,
    //    동률이면 정의 많은 순. 상한이 있어야 단어가 늘어도 전송량이 고정된다.
    const words = await this.prisma.$queryRaw<
      { word: string; count: number; myCount: number; lastActivityAt: Date }[]
    >`
      SELECT e.word, COUNT(*)::int AS count,
             -- 카드에 "내 정의" 표시용. 같은 WHERE 안이라 숨김 규칙이 목록과 어긋나지 않는다.
             (COUNT(*) FILTER (WHERE e."userId" = ${me}))::int AS "myCount",
             MAX(e."savedAt") AS "lastActivityAt"
      FROM entries e
      WHERE e.hidden = false ${notBlocked}
      GROUP BY e.word
      ORDER BY MAX(e."savedAt") DESC, COUNT(*) DESC
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
      SELECT id, word, nickname, text, "likeCount", "isMine" FROM (
        SELECT e.id, e.word, u.nickname, e.text,
               (e."userId" = ${me}) IS TRUE AS "isMine",
               COUNT(l.id)::int AS "likeCount",
               ROW_NUMBER() OVER (
                 PARTITION BY e.word
                 ORDER BY COUNT(l.id) DESC, e."savedAt" DESC
               ) AS rn
        FROM entries e
        JOIN users u ON u.id = e."userId"
        LEFT JOIN likes l ON l."entryId" = e.id
        WHERE e.word = ANY(${wordList}) AND e.hidden = false ${notBlocked}
        GROUP BY e.id, e.word, e."userId", u.nickname, e.text, e."savedAt"
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
        isMine: r.isMine,
      };
      const bucket = previewsByWord.get(r.word);
      if (bucket) bucket.push(preview);
      else previewsByWord.set(r.word, [preview]);
    }

    // 순서는 ①이 정한 그대로. ②의 반환 순서는 단어 간 순위와 무관하다.
    return words.map((w) => ({
      word: w.word,
      count: w.count,
      myCount: w.myCount,
      previews: previewsByWord.get(w.word) ?? [],
      lastActivityAt: w.lastActivityAt,
    }));
  }

  async getStats(userId: string, since: Date): Promise<PlazaStatsRow> {
    // 목록·상세와 **같은 것만 센다.** 숨겨진 글(신고 누적)과 내가 차단한 사람의 글이
    // 통계에만 남아 있으면 "이번 주 23개"인데 목록엔 22개가 보이는 식으로 숫자가 어긋난다.
    // 사용자는 그걸 버그로 읽는다.
    const visible = {
      hidden: false,
      user: { blocksReceived: { none: { blockerId: userId } } },
    };
    const notBlocked = Prisma.sql`AND e."userId" NOT IN (SELECT "blockedId" FROM blocks WHERE "blockerId" = ${userId})`;

    const weekDefinitions = await this.prisma.entry.count({
      where: { createdAt: { gte: since }, ...visible },
    });

    const contributorGroups = await this.prisma.entry.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since }, ...visible },
    });
    const weekContributors = contributorGroups.length;

    // 내가 받은 좋아요는 **내 글** 기준이라 차단·숨김과 무관하다. 내가 누군가를 차단했다고
    // 내 글이 받은 좋아요가 줄어들 이유가 없다.
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
      WHERE e.hidden = false ${notBlocked}
      GROUP BY e.word ORDER BY COUNT(l.id) DESC LIMIT 1
    `;
    const mostDefined = await this.prisma.$queryRaw<{ word: string; count: number }[]>`
      SELECT e.word, COUNT(*)::int AS count
      FROM entries e
      WHERE e.hidden = false ${notBlocked}
      GROUP BY e.word ORDER BY COUNT(*) DESC LIMIT 1
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
    page: { mine: true } | { mine: false; skip: number; take: number },
  ): Promise<PlazaDefinitionRow[]> {
    const rows = await this.prisma.entry.findMany({
      // 숨겨진 정의는 광장에서만 사라진다(작성자 단어장엔 남는다).
      // blocksReceived.none = "나를 차단한 사람 중에 요청자가 없는" 작성자만 — 차단은 단방향이고
      // 상대는 모른다. 차단당한 쪽 화면은 그대로다.
      where: {
        word,
        hidden: false,
        user: { blocksReceived: { none: { blockerId: userId } } },
        userId: page.mine ? userId : { not: userId },
      },
      // 정렬을 DB가 해야 skip/take가 "좋아요 상위 N개"가 된다. id는 동점 순서를 고정하는 마지막 기준.
      orderBy: page.mine
        ? { savedAt: 'desc' }
        : [{ likes: { _count: 'desc' } }, { savedAt: 'desc' }, { id: 'desc' }],
      ...(page.mine ? {} : { skip: page.skip, take: page.take }),
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

  async addReport(
    reporterId: string,
    entryId: string,
    reason: string,
    hideThreshold: number,
  ): Promise<void> {
    // 신고 1건과 카운터 증가가 따로 커밋되면 숫자가 어긋난다 → 한 트랜잭션.
    await this.prisma.$transaction(async (tx) => {
      // createMany + skipDuplicates: (reporterId, entryId) 유니크에 걸리면 조용히 0건.
      // 재신고로 카운트가 부풀지 않는다 — upsert보다 "중복이면 아무 일도 없음"이 직접적이다.
      const { count } = await tx.report.createMany({
        data: [{ reporterId, entryId, reason }],
        skipDuplicates: true,
      });
      if (count === 0) return;

      const entry = await tx.entry.update({
        where: { id: entryId },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true },
      });
      if (entry.reportCount >= hideThreshold) {
        await tx.entry.update({ where: { id: entryId }, data: { hidden: true } });
      }
    });
  }

  async addBlock(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.block.createMany({
      data: [{ blockerId, blockedId }],
      skipDuplicates: true,
    });
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    // deleteMany는 없는 행을 지워도 오류가 아니다 — 그게 멱등 해제에 맞다.
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  async listBlocked(blockerId: string): Promise<PlazaBlockedUserRow[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      select: { blocked: { select: { id: true, nickname: true } } },
    });
    return rows.map((r) => r.blocked);
  }
}
