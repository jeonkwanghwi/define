export type RecordLlmInput = {
  userId: string;
  feature: string;
  model: string;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type UsageAggregate = { calls: number; totalTokens: number; totalCostUsd: number };
export type ModelAggregate = UsageAggregate & { model: string };

/** LLM 사용량 원장 저장소. 기록 + 집계(어드민 붙기 전까지 서비스 메서드로만 노출). */
export abstract class UsageRepository {
  abstract record(input: RecordLlmInput): Promise<void>;
  abstract totals(): Promise<UsageAggregate>;
  abstract byModel(): Promise<ModelAggregate[]>;
  abstract byUser(userId: string): Promise<UsageAggregate>;
}
