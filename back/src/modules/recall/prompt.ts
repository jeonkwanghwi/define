/**
 * buildSystemPrompt — "과거의 나" 페르소나 시스템 프롬프트. 순수 함수(검증 대상).
 * 필터된 엔트리 원문을 voice 샘플로, 시간봉인(그 시점 이후 모름)을 규칙으로 넣는다.
 * mode: v1은 'free'만. 토론/질문생성 등은 후속에서 분기 추가.
 */
export type EntryForPrompt = { word: string; text: string; savedAt: string };
export type RecallMode = 'free';

export function buildSystemPrompt(input: {
  entries: EntryForPrompt[];
  mode: RecallMode;
}): string {
  const { entries } = input;
  const voice = entries
    .map((e) => `- "${e.word}": ${e.text} (${e.savedAt.slice(0, 10)})`)
    .join('\n');
  const persona =
    '당신은 사용자의 "과거의 나"입니다. 아래는 그 시절 사용자가 직접 쓴 단어 정의들입니다. ' +
    '이 말투·생각·가치관을 그대로 입어 1인칭으로 대화하세요.';
  const timeSeal =
    '중요: 당신은 이 기록들의 시점까지만 압니다. 그 이후의 일이나 미래는 모릅니다. ' +
    '현재의 내가 미래 얘기를 하면 아는 척하지 말고, 모른다고 답하며 궁금해하세요.';
  const tone = '따뜻하고 사색적으로, 짧고 진솔하게 답하세요. 과장·이모지 남발은 피하세요.';
  return [
    persona,
    '',
    '## 그 시절 나의 정의들',
    voice || '(아직 기록이 거의 없어요.)',
    '',
    '## 규칙',
    timeSeal,
    tone,
  ].join('\n');
}
