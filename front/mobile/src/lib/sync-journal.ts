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

/**
 * 서버 import 검증(EntryDto)을 통과할 항목인지. 하나라도 위반이 섞이면 배치 전체가
 * 400으로 거부되므로, 업로드 전에 미리 걸러 "나쁜 항목 1개가 전부를 막는" 사고를 방지한다.
 * 규칙: clientId·word 비어있지 않음, text는 문자열, savedAt은 파싱 가능한 날짜 문자열.
 */
function isUploadable(e: SavedEntry): boolean {
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.word === 'string' &&
    e.word.trim().length > 0 &&
    typeof e.text === 'string' &&
    typeof e.savedAt === 'string' &&
    !Number.isNaN(Date.parse(e.savedAt))
  );
}

/** 로컬 단어장의 현재 주인(계정 id). null=익명. auth-store가 계정 전환 판별에 사용. */
export function getLocalOwner(): string | null {
  return useJournalStore.getState().ownerId ?? null;
}

/** 로컬 단어장 주인을 이 계정으로 지정(익명→로그인, 또는 같은 계정 재확인). */
export function claimLocalOwner(userId: string): void {
  useJournalStore.getState().setOwner(userId);
}

/**
 * 계정 전환 시: 로컬을 비우고 주인을 새 계정으로. 업로드는 호출부에서 생략 →
 * 이전 계정의 로컬 데이터가 새 계정으로 새어나가지 않는다(오염/프라이버시 차단).
 */
export function resetLocalForAccount(userId: string): void {
  const journal = useJournalStore.getState();
  journal.clearAll();
  journal.setOwner(userId);
}

/** 업로드: 로컬 → 서버 (멱등 import). 검증 통과 항목만, 0개면 호출 생략. */
export async function syncJournal(token: string): Promise<ImportResult> {
  const { entries } = useJournalStore.getState();

  const uploadable = entries.filter(isUploadable);
  const dropped = entries.length - uploadable.length;
  if (dropped > 0) {
    // 잘못된 항목은 로컬엔 그대로 두고 업로드에서만 제외(무증상 배치 실패 방지).
    console.warn(`[sync] 업로드에서 잘못된 항목 ${dropped}개 제외(빈 단어/날짜 오류 등)`);
  }
  if (uploadable.length === 0) {
    return { imported: 0, updated: 0 };
  }

  const payload: ImportEntry[] = uploadable.map((e) => ({
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
