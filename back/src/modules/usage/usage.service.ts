import { Injectable } from '@nestjs/common';

import { priceFor, TokenUsage } from './llm-pricing';
import { ModelAggregate, UsageAggregate, UsageRepository } from './usage.repository';

@Injectable()
export class UsageService {
  constructor(private readonly repo: UsageRepository) {}

  /**
   * LLM 호출 사용량 기록. 비치명적 — 실패해도 throw 안 함(호출부 흐름 보호).
   * @param usage prompt/cached/completion + (선택)totalTokens. total 없으면 prompt+completion.
   */
  async recordLlm(input: {
    userId: string;
    feature: string;
    model: string;
    usage: TokenUsage & { totalTokens?: number };
  }): Promise<void> {
    try {
      const { userId, feature, model, usage } = input;
      const totalTokens = usage.totalTokens ?? usage.promptTokens + usage.completionTokens;
      const costUsd = priceFor(model, usage);
      await this.repo.record({
        userId,
        feature,
        model,
        promptTokens: usage.promptTokens,
        cachedTokens: usage.cachedTokens,
        completionTokens: usage.completionTokens,
        totalTokens,
        costUsd,
      });
    } catch (e) {
      console.warn('[usage] 사용량 기록 실패(비치명적):', e);
    }
  }

  totals(): Promise<UsageAggregate> {
    return this.repo.totals();
  }
  byModel(): Promise<ModelAggregate[]> {
    return this.repo.byModel();
  }
  byUser(userId: string): Promise<UsageAggregate> {
    return this.repo.byUser(userId);
  }
}
