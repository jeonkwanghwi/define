/**
 * WordResponse (DTO) — 클라이언트(프론트)에게 내보내는 응답의 모양.
 *
 * DTO = Data Transfer Object. "바깥과 주고받는 형태"를 entity(내부 도메인)와 분리한다.
 * 지금은 entity와 같아 보이지만, 분리해두면 나중에 응답에만 필드를 더하거나
 * 내부 필드를 숨길 때 서로 안 흔들린다.
 *
 * 예시 응답: { "id": "ck...", "text": "행복" }
 */
export class WordResponse {
  id: string;
  text: string;

  constructor(partial: Partial<WordResponse>) {
    Object.assign(this, partial);
  }
}

/**
 * RecommendedWordsResponse — 홈의 "오늘의 단어" 풀.
 *
 * 단어 문자열만 담는다: 앱은 이 풀 안에서 "다시 뽑기"를 돌리기만 하므로 id도 태그도 필요 없다.
 * (태그는 추천 가중치일 뿐 사용자에게 보이지 않는다 — seed-words.ts의 원칙.)
 *
 * 예시 응답: { "words": ["행복", "시간", "용기"] }
 */
export class RecommendedWordsResponse {
  words: string[];

  constructor(partial: Partial<RecommendedWordsResponse>) {
    Object.assign(this, partial);
  }
}
