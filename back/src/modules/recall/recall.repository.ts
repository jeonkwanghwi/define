/**
 * RecallRepository — 회상이 보는 DB(User 일부 + Entry). 구현은 .prisma.ts.
 * journal/currency와 같은 user/entry 테이블을 보지만, 회상이 필요한 필드만 다룬다.
 */
export type RecallUserContext = {
  birthYear: number | null;
  recallConsentAt: Date | null;
  /** 채팅 말투 프로필(특징 요약). 아직 없으면 null. */
  speechProfile: string | null;
};
export type RecallEntry = {
  word: string;
  text: string;
  savedAt: string;
  changeNote: string | null; // "이전과 달라진 점" — 생각의 변화 단서
};

export abstract class RecallRepository {
  /** 나이 필터·동의 확인용. 사용자 없으면 null. */
  abstract findUserContext(userId: string): Promise<RecallUserContext | null>;
  /** 동의 시각 기록. */
  abstract setConsent(userId: string, at: Date): Promise<void>;
  /** 내 엔트리(word/text/savedAt) 최신순. 프롬프트 voice 샘플용. */
  abstract findEntries(userId: string): Promise<RecallEntry[]>;
  /** 말투 프로필 갱신(대화에서 추출한 요약으로 통째 교체). */
  abstract updateSpeechProfile(userId: string, profile: string): Promise<void>;
}
