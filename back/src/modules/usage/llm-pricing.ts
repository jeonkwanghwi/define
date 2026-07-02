/**
 * LLM 모델별 단가표(USD per 1M tokens) + 비용 계산.
 * ⚠️ 가격은 OpenAI 공식 가격 페이지 기준으로 주기 확인/갱신. 이 맵 한 곳만 고치면 됨.
 */
export type TokenUsage = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
};

/** USD per 1,000,000 tokens */
type Rate = { input: number; cachedInput: number; output: number };

const PRICING: Record<string, Rate> = {
  'gpt-4.1-mini': { input: 0.4, cachedInput: 0.1, output: 1.6 },
};

/** 응답 model(스냅샷 포함 가능: gpt-4.1-mini-2025-04-14)을 단가표 키로 정규화. */
function normalizeModel(model: string): string {
  return Object.keys(PRICING).find((k) => model === k || model.startsWith(k)) ?? model;
}

/**
 * 토큰 사용량 → USD 비용. 캐시된 입력은 비캐시 입력에서 빼고 별도(더 싼) 단가 적용.
 * 단가표에 없는 모델이면 0 반환 + 경고(집계 왜곡 방지 위해 가격표에 추가 필요).
 */
export function priceFor(model: string, usage: TokenUsage): number {
  const rate = PRICING[normalizeModel(model)];
  if (!rate) {
    console.warn(`[usage] 단가 미등록 모델: ${model} — 비용 0으로 기록(가격표에 추가 필요)`);
    return 0;
  }
  const uncachedInput = Math.max(0, usage.promptTokens - usage.cachedTokens);
  return (
    (uncachedInput / 1_000_000) * rate.input +
    (usage.cachedTokens / 1_000_000) * rate.cachedInput +
    (usage.completionTokens / 1_000_000) * rate.output
  );
}
