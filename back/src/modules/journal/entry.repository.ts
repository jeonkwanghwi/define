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

/** 서버가 돌려주는 entry 한 개 (다운로드용). 로컬 SavedEntry로 그대로 복원된다. */
export interface EntryRecord {
  clientId: string;
  word: string;
  text: string;
  changeNote?: string;
  savedAt: string; // ISO
}

export abstract class EntryRepository {
  /** (userId, clientId) 기준 upsert. 신규면 {created:true}, 기존이면 {created:false}. */
  abstract upsert(userId: string, input: EntryInput): Promise<{ created: boolean }>;
  /** 한 사용자의 모든 entry를 최신순으로. 다운로드 동기화(서버→로컬)용. */
  abstract findByUserId(userId: string): Promise<EntryRecord[]>;
  /** (userId, clientId) 기준 삭제. 대상 없어도 에러 없이 멱등(삭제 동기화용). */
  abstract deleteByClientId(userId: string, clientId: string): Promise<void>;
}
