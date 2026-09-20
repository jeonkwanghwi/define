/**
 * VillageService — 마을 로직.
 *   - listNeighbors: 이웃 후보를 섞어 정확히 count개로 채운다.
 * 후보가 count보다 적으면 같은 유저를 다시 꺼내 쓴다(빈집보다 중복이 낫다 — v1 설계).
 * 닉네임 없으면 '익명'(광장과 동일).
 */
import { Injectable } from '@nestjs/common';

import { VillageNeighborsResponse } from './dto/village.response';
import { VillageNeighborRow, VillageRepository } from './village.repository';

/** 집 시트에 보여줄 정의 수 상한. */
const WORDS_PER_NEIGHBOR = 5;

/** Fisher-Yates — 원본은 두고 섞은 사본을 돌려준다. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

@Injectable()
export class VillageService {
  constructor(private readonly repo: VillageRepository) {}

  async listNeighbors(userId: string, count: number): Promise<VillageNeighborsResponse> {
    const candidates = await this.repo.findNeighborCandidates(
      userId,
      WORDS_PER_NEIGHBOR,
    );
    if (candidates.length === 0) {
      return { neighbors: [] };
    }

    // 한 바퀴 = 후보 전원을 섞어 한 번씩. 모자라면 다시 섞어 이어 붙인다.
    const picked: VillageNeighborRow[] = [];
    while (picked.length < count) {
      picked.push(...shuffle(candidates));
    }

    return {
      neighbors: picked.slice(0, count).map((c) => ({
        id: c.id,
        nickname: c.nickname ?? '익명',
        words: c.words.map((w) => ({
          word: w.word,
          text: w.text,
          savedAt: w.savedAt.toISOString(),
        })),
      })),
    };
  }
}
