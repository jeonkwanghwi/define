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
