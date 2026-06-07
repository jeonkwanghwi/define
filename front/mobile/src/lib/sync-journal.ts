/**
 * sync-journal — 로컬 단어장을 서버로 업로드(멱등). 인증 직후 호출.
 *
 * journal-store에서 직접 entries를 읽어 import payload로 변환한다.
 * → auth-store는 journal-store를 import하지 않는다(관심사 분리). 변환·업로드는 여기 한 곳.
 *
 * 로컬 SavedEntry.id → 서버 clientId 보존 → 백엔드 (userId, clientId) 멱등 upsert.
 * entries가 0개면 호출 생략(서버 @ArrayMinSize(1) 위반 회피).
 */
import { importJournal, type ImportEntry, type ImportResult } from '@/services/journal-api';
import { useJournalStore } from '@/store/journal-store';

export async function syncJournal(token: string): Promise<ImportResult> {
  const { entries } = useJournalStore.getState();
  if (entries.length === 0) {
    return { imported: 0, updated: 0 };
  }

  const payload: ImportEntry[] = entries.map((e) => ({
    clientId: e.id,
    word: e.word,
    text: e.text,
    changeNote: e.changeNote,
    savedAt: e.savedAt,
  }));

  return importJournal(token, payload);
}
