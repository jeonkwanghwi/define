/**
 * EntryRepository — Entry DB 접근 계약.
 * upsert는 (userId, clientId) 유니크로 멱등 처리하고,
 * "새로 만들었는지(created)"를 돌려준다 → service가 imported/updated 카운트에 사용.
 */
export interface EntryInput {
  clientId: string;
  word: string;
  text: string;
  changeNote?: string;
  savedAt: Date;
}

export abstract class EntryRepository {
  /** (userId, clientId) 기준 upsert. 신규면 {created:true}, 기존이면 {created:false}. */
  abstract upsert(userId: string, input: EntryInput): Promise<{ created: boolean }>;
}
