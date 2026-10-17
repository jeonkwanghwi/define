/**
 * PlazaService — 광장 로직.
 *   - listWords: 단어+정의 수 목록.
 *   - getWord: 한 단어의 정의들에 isMine 표시 + 내 정의를 맨 위로.
 *   - toggleLike: 좋아요 토글(멱등). 내 정의 불가(400)·없는 정의(404).
 *   - report/block/unblock/listBlocked: 중재(Apple 심사 가이드 1.2). 전부 멱등.
 * 닉네임 없으면 '익명'.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  PlazaBlockedUsersResponse,
  PlazaLikeResponse,
  PlazaStatsResponse,
  PlazaWordDetailResponse,
  PlazaWordResponse,
} from './dto/plaza.response';
import { PlazaRepository } from './plaza.repository';

/** 통계 "이번 주" = 최근 7일(롤링). */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 광장 첫 화면에 내려보낼 단어 수 상한. 활동순 상위 N개까지만 보인다.
 * "더 보기"(페이지네이션)는 후속 — 지금은 상한을 두는 것만으로 충분하다.
 */
const PLAZA_WORD_LIMIT = 100;

/**
 * 이만큼 쌓이면 자동으로 감춘다. 사람이 매번 보지 않아도 도는 최소한의 필터.
 * 1이면 한 사람의 악의로 남의 글이 사라지고, 너무 높으면 필터가 늦게 돈다.
 * 사용자가 적은 지금은 3이 적당하고, 사람이 많아지면 올린다.
 */
export const REPORT_HIDE_THRESHOLD = 3;

/** 단어 상세에서 한 번에 내려보낼 남의 정의 수. 앱은 바닥에 닿으면 다음 쪽을 부른다. */
export const PLAZA_DEFINITION_PAGE = 10;

@Injectable()
export class PlazaService {
  constructor(private readonly repo: PlazaRepository) {}

  async listWords(userId: string): Promise<PlazaWordResponse[]> {
    const rows = await this.repo.listWordsWithCounts(PLAZA_WORD_LIMIT, userId);
    return rows.map((r) => ({
      word: r.word,
      count: r.count,
      previews: r.previews.map((p) => ({
        id: p.id,
        nickname: p.nickname ?? '익명',
        text: p.text,
        likeCount: p.likeCount,
      })),
    }));
  }

  async getStats(userId: string): Promise<PlazaStatsResponse> {
    const since = new Date(Date.now() - WEEK_MS);
    return this.repo.getStats(userId, since);
  }

  /**
   * 한 단어의 정의 한 쪽. offset 0(첫 쪽)에만 내 정의를 맨 위에 붙인다 — 몇 개 안 되고,
   * 쪽마다 끼면 중복된다. 남의 정의는 좋아요 많은 순으로 PLAZA_DEFINITION_PAGE개씩.
   *
   * ponytail: offset 방식이라 쪽을 넘기는 사이 좋아요 순위가 바뀌면 한 장이 겹치거나 빠질 수 있다.
   *   겹침은 앱이 id로 걸러낸다. 빠짐이 문제가 될 만큼 커지면 (좋아요 수, savedAt, id) 커서로 바꿀 것.
   */
  async getWord(word: string, userId: string, offset = 0): Promise<PlazaWordDetailResponse> {
    // 한 장 더 받아 보고 넘치면 "더 있다" — 개수를 따로 세는 쿼리가 필요 없다.
    const others = await this.repo.findDefinitionsByWord(word, userId, {
      mine: false,
      skip: offset,
      take: PLAZA_DEFINITION_PAGE + 1,
    });
    const hasMore = others.length > PLAZA_DEFINITION_PAGE;
    const mine = offset === 0 ? await this.repo.findDefinitionsByWord(word, userId, { mine: true }) : [];
    const rows = [...mine, ...others.slice(0, PLAZA_DEFINITION_PAGE)];
    const definitions = rows.map((r) => ({
      id: r.id,
      authorId: r.userId,
      nickname: r.nickname ?? '익명',
      text: r.text,
      savedAt: r.savedAt.toISOString(),
      isMine: r.userId === userId,
      likeCount: r.likeCount,
      isLiked: r.likedByMe,
    }));
    return { word, definitions, hasMore };
  }

  async toggleLike(userId: string, entryId: string): Promise<PlazaLikeResponse> {
    const ownerId = await this.repo.getEntryOwner(entryId);
    if (ownerId === null) {
      throw new NotFoundException('정의를 찾을 수 없어요.');
    }
    if (ownerId === userId) {
      throw new BadRequestException('내 정의에는 좋아요를 누를 수 없어요.');
    }
    return this.repo.toggleLike(userId, entryId);
  }

  /** 신고. 자기 글은 400, 재신고는 조용히 넘긴다(두 번 눌렀다고 오류를 보일 일이 아니다). */
  async report(userId: string, entryId: string, reason: string): Promise<void> {
    const ownerId = await this.repo.getEntryOwner(entryId);
    if (ownerId === null) {
      throw new NotFoundException('정의를 찾을 수 없어요.');
    }
    if (ownerId === userId) {
      throw new BadRequestException('내 정의는 신고할 수 없어요.');
    }
    await this.repo.addReport(userId, entryId, reason, REPORT_HIDE_THRESHOLD);
  }

  /** 차단. 자기 자신은 400(의미 없다). 이미 차단했으면 그대로 성공. */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('자기 자신은 차단할 수 없어요.');
    }
    await this.repo.addBlock(blockerId, blockedId);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.repo.removeBlock(blockerId, blockedId);
  }

  async listBlocked(userId: string): Promise<PlazaBlockedUsersResponse> {
    const rows = await this.repo.listBlocked(userId);
    return {
      users: rows.map((r) => ({ id: r.id, nickname: r.nickname ?? '익명' })),
    };
  }
}
