/**
 * PlazaService — 광장 로직.
 *   - listWords: 단어+정의 수 목록.
 *   - getWord: 한 단어의 정의들에 isMine 표시 + 내 정의를 맨 위로.
 * 닉네임 없으면 '익명'. 내 정의 맨 위 정렬은 V8 안정 정렬에 의존(그 외 savedAt 역순 유지).
 */
import { Injectable } from '@nestjs/common';

import {
  PlazaWordDetailResponse,
  PlazaWordResponse,
} from './dto/plaza.response';
import { PlazaRepository } from './plaza.repository';

@Injectable()
export class PlazaService {
  constructor(private readonly repo: PlazaRepository) {}

  async listWords(): Promise<PlazaWordResponse[]> {
    return this.repo.listWordsWithCounts();
  }

  async getWord(word: string, userId: string): Promise<PlazaWordDetailResponse> {
    const rows = await this.repo.findDefinitionsByWord(word, userId);
    const definitions = rows.map((r) => ({
      id: r.id,
      nickname: r.nickname ?? '익명',
      text: r.text,
      savedAt: r.savedAt.toISOString(),
      isMine: r.userId === userId,
      likeCount: r.likeCount,
      isLiked: r.likedByMe,
    }));
    // 내 정의 맨 위 → 좋아요 많은 순. repo가 savedAt 역순이라 동점은 안정 정렬로 최신 우선 유지.
    definitions.sort(
      (a, b) => Number(b.isMine) - Number(a.isMine) || b.likeCount - a.likeCount,
    );
    return { word, definitions };
  }
}
