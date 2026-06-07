/**
 * EntryEntity — 사용자 정의 단어 한 개(서버 저장본). 로컬 SavedEntry의 쌍둥이.
 */
export class EntryEntity {
  id: string;
  clientId: string;
  userId: string;
  word: string;
  text: string;
  changeNote: string | null;
  savedAt: Date;
  createdAt: Date;
}
