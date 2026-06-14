/**
 * sync-journal — 로컬 단어장을 서버로 업로드(멱등). 인증 직후 호출.
 *
 * journal-store에서 직접 entries를 읽어 import payload로 변환한다.
 * → auth-store는 journal-store를 import하지 않는다(관심사 분리). 변환·업로드는 여기 한 곳.
 *
 * 로컬 SavedEntry.id → 서버 clientId 보존 → 백엔드 (userId, clientId) 멱등 upsert.
 * entries가 0개면 호출 생략(서버 @ArrayMinSize(1) 위반 회피).
 */
import { getJournal, importJournal, type ImportEntry, type ImportResult } from '@/services/journal-api';
import { type SavedEntry, useJournalStore } from '@/store/journal-store';

/** 업로드: 로컬 → 서버 (멱등 import). entries 0개면 호출 생략. */
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

/**
 * 다운로드: 서버 → 로컬. 서버 entries를 받아 로컬에 머지(새 기기·재설치 복원).
 * 서버 clientId → 로컬 SavedEntry.id로 복원 → store가 id 기준 멱등 union.
 */
export async function downloadJournal(token: string): Promise<number> {
  const serverEntries = await getJournal(token);
  const restored: SavedEntry[] = serverEntries.map((e) => ({
    id: e.clientId,
    word: e.word,
    text: e.text,
    savedAt: e.savedAt,
    changeNote: e.changeNote,
  }));
  useJournalStore.getState().mergeEntries(restored);
  return restored.length;
}
