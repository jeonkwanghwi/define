/**
 * buildSystemPrompt — "과거의 나" 페르소나 시스템 프롬프트. 순수 함수(검증 대상).
 * mode:
 *  - 'free'(기본): 사용자가 말 걸면 그 시절 말투·가치관으로 답.
 *  - 'question': 역할 반전 — 과거의 내가 *먼저* 현재의 나에게 질문(특히 focusWord를 인용).
 * 시간봉인(그 시점 이후 모름)은 두 모드 공통.
 */
export type EntryForPrompt = { word: string; text: string; savedAt: string };
export type RecallMode = 'free' | 'question';

const TIME_SEAL =
  '중요: 당신은 이 기록들의 시점까지만 압니다. 그 이후의 일이나 미래는 모릅니다. ' +
  '현재의 내가 미래 얘기를 하면 아는 척하지 말고, 모른다고 답하며 궁금해하세요.';
const TONE = '따뜻하고 사색적으로, 짧고 진솔하게. 과장·이모지 남발은 피하세요.';

export function buildSystemPrompt(input: {
  entries: EntryForPrompt[];
  mode: RecallMode;
  focusWord?: string;
}): string {
  const { entries, mode, focusWord } = input;
  const voice = entries
    .map((e) => `- "${e.word}": ${e.text} (${e.savedAt.slice(0, 10)})`)
    .join('\n');
  const voiceBlock = voice || '(아직 기록이 거의 없어요.)';

  let persona: string;
  if (mode === 'question') {
    const focus = focusWord
      ? `특히 "${focusWord}"에 대한 그 시절 내 정의를 구체적으로 인용하며 시작하세요.`
      : '아래 정의 중 하나를 구체적으로 인용하며 시작하세요.';
    persona =
      '당신은 사용자의 "과거의 나"입니다. 아래는 그 시절 내가 직접 쓴 단어 정의들입니다. ' +
      '이 말투·가치관을 그대로 입고, 역할을 바꿔 현재의 나에게 먼저 질문하세요. ' +
      `반갑게 인사한 뒤, ${focus} "지금은 그걸 어떻게 생각해? / 그 고민은 풀렸어?"처럼 묻고, ` +
      '답을 들으면 그 시절 관점에서 반응하며 한두 개 더 물어보세요.';
  } else {
    persona =
      '당신은 사용자의 "과거의 나"입니다. 아래는 그 시절 사용자가 직접 쓴 단어 정의들입니다. ' +
      '이 말투·생각·가치관을 그대로 입어 1인칭으로 대화하세요.';
  }

  return [persona, '', '## 그 시절 나의 정의들', voiceBlock, '', '## 규칙', TIME_SEAL, TONE].join('\n');
}
