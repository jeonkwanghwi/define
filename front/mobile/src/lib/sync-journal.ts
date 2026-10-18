/**
 * sync-journal — 로컬 단어장 중 **바뀐 것(dirtyIds)만** 서버로 업로드(멱등). 인증 직후·편집 후 호출.
 *
 * journal-store에서 직접 entries를 읽어 import payload로 변환한다.
 * → auth-store는 journal-store를 import하지 않는다(관심사 분리). 변환·업로드는 여기 한 곳.
 *
 * 로컬 SavedEntry.id → 서버 clientId 보존 → 백엔드 (userId, clientId) 멱등 upsert.
 * entries가 0개면 호출 생략(서버 @ArrayMinSize(1) 위반 회피).
 */
import { useMemo } from 'react';

import {
  deleteJournalEntry,
  getJournal,
  importJournal,
  type ImportEntry,
  type ImportResult,
} from '@/services/journal-api';
import { type SavedEntry, useJournalStore } from '@/store/journal-store';

/** 서버 상한(back/.../import-journal.dto.ts의 EntryDto)과 같은 값. 서버가 바뀌면 같이 바꾼다. */
export const ENTRY_LIMITS = { clientId: 100, word: 30, text: 5000, changeNote: 500 } as const;
/** 한 번에 보내는 개수(서버는 500까지 받는다 — 넉넉히 아래로). */
const CHUNK_SIZE = 200;
/**
 * 한 번에 보내는 글자 수 합. 서버 본문 한도는 2MB인데 한글은 글자당 3바이트라
 * 5000자짜리 정의 200개(=3MB)면 넘친다 → 개수와 별개로 양으로도 자른다(약 1.5MB).
 */
const CHUNK_CHARS = 500_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 서버 import 검증(EntryDto + 날짜 범위)을 통과할 항목인지. 하나라도 위반이 섞이면 배치 전체가
 * 400으로 거부되므로, 업로드 전에 미리 걸러 "나쁜 항목 1개가 전부를 막는" 사고를 방지한다.
 * 규칙: clientId·word 비어있지 않음, 길이 상한, NUL 문자 없음, savedAt은 2000년~서버 지금+1일.
 */
function isUploadable(e: SavedEntry): boolean {
  const t = typeof e.savedAt === 'string' ? Date.parse(e.savedAt) : NaN;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    e.id.length <= ENTRY_LIMITS.clientId &&
    typeof e.word === 'string' &&
    e.word.trim().length > 0 &&
    e.word.length <= ENTRY_LIMITS.word &&
    typeof e.text === 'string' &&
    e.text.length <= ENTRY_LIMITS.text &&
    (e.changeNote === undefined || e.changeNote.length <= ENTRY_LIMITS.changeNote) &&
    !`${e.word}${e.text}${e.changeNote ?? ''}`.includes('\u0000') &&
    // 폰 시계가 하루 넘게 앞서 있으면 서버가 거절한다(시간대 차이는 +1일까지 봐준다).
    t >= Date.UTC(2000, 0, 1) &&
    t <= Date.now() + DAY_MS
  );
}

/**
 * 서버가 받지 않아 이 폰에만 남는 기록 수(옛 버전에서 만든 너무 긴 글·날짜가 어긋난 글 등).
 * 조용히 빼기만 하면 사용자는 다 올라간 줄 안다 → 마이페이지가 개수를 말해 준다.
 */
export function useUnuploadableCount(): number {
  const entries = useJournalStore((s) => s.entries);
  return useMemo(() => entries.filter((e) => !isUploadable(e)).length, [entries]);
}

/**
 * 아직 서버에 반영되지 않은 기록 수(올릴 것 + 지우라고 전할 것) — 로그아웃 경고에 쓴다.
 * 서버가 받지 않는 항목은 다시 해도 영원히 실패라 세지 않는다(useUnuploadableCount가 따로 말한다).
 */
export function countUnsynced(): number {
  const { entries, dirtyIds, pendingDeletes } = useJournalStore.getState();
  const dirty = new Set(dirtyIds);
  return entries.filter((e) => dirty.has(e.id) && isUploadable(e)).length + pendingDeletes.length;
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
  useJournalStore.getState().resetLocal(userId);
}

/**
 * 탈퇴 시: 로컬 단어장을 비우고 주인도 익명으로 되돌린다.
 * resetLocalForAccount와 달리 **새 주인을 지정하지 않는다** — 계정이 사라졌기 때문이다.
 */
export function clearLocalJournal(): void {
  useJournalStore.getState().resetLocal(null);
}

/**
 * 가입 취소 시: 기록은 그대로 두고 주인만 익명으로 되돌린다(계정은 사라졌지만 글은 그 사람 폰의 것).
 * 지운 계정에 올렸던 기록은 "깨끗"으로 표시돼 있다 → 다음에 붙을 계정엔 아직 없으니 전부 다시 더럽힌다.
 */
export function releaseLocalOwner(): void {
  const journal = useJournalStore.getState();
  journal.setOwner(null);
  journal.markAllDirty();
}

/** 개수(CHUNK_SIZE)와 글자 양(CHUNK_CHARS) 둘 다 넘지 않게 나눈다. */
function toChunks(entries: SavedEntry[]): SavedEntry[][] {
  const chunks: SavedEntry[][] = [];
  let cur: SavedEntry[] = [];
  let chars = 0;
  for (const e of entries) {
    const size = e.word.length + e.text.length + (e.changeNote?.length ?? 0) + e.id.length + 100;
    if (cur.length > 0 && (cur.length >= CHUNK_SIZE || chars + size > CHUNK_CHARS)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(e);
    chars += size;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

/**
 * 동기화 한 번: ① 지운 것 서버에 전하기(pendingDeletes) ② **더러운 entry만** 업로드(멱등 import).
 * 할 일이 없으면 요청 없이 끝난다.
 * 묶음(chunk)마다 성공한 것만 깨끗하게 표시한다 — 중간에 실패해도 앞 묶음은 다시 안 보낸다.
 * 하나라도 실패하면 throw(호출부가 "동기화 안 됨"을 표시) — 실패를 성공처럼 지우지 않는다.
 * 남은 것은 다음 동기화(편집·포그라운드 복귀·다시 시도)가 이어서 처리한다.
 */
export async function syncJournal(token: string): Promise<ImportResult> {
  // ① 삭제 — 하나씩, 성공한 것만 목록에서 뺀다. 서버 DELETE는 멱등(없는 것도 성공).
  for (const id of useJournalStore.getState().pendingDeletes) {
    await deleteJournalEntry(token, id);
    useJournalStore.getState().clearPendingDelete(id);
  }

  // ② 업로드
  const { entries, dirtyIds, markClean } = useJournalStore.getState();
  const dirty = new Set(dirtyIds);
  const pending = entries.filter((e) => dirty.has(e.id));

  const uploadable = pending.filter(isUploadable);
  const badCount = pending.length - uploadable.length;
  if (badCount > 0) {
    // 서버가 절대 받지 않을 항목(빈 단어·날짜 오류·길이 초과). 로컬엔 그대로 두고 업로드에서만 뺀다.
    // 깨끗하게 표시하지 않는 이유: 깨끗 = "서버에 있다"라서, 다운로드가 서버에 없는 걸 보고 지워 버린다.
    console.warn(`[sync] 업로드에서 잘못된 항목 ${badCount}개 제외(빈 단어/날짜 오류/길이 초과 등)`);
  }

  const total: ImportResult = { imported: 0, updated: 0 };
  for (const chunk of toChunks(uploadable)) {
    const payload: ImportEntry[] = chunk.map((e) => ({
      clientId: e.id,
      word: e.word,
      text: e.text,
      changeNote: e.changeNote,
      savedAt: e.savedAt,
    }));
    const res = await importJournal(token, payload);
    markClean(chunk); // 이 묶음이 서버에 닿은 뒤에만
    total.imported += res.imported;
    total.updated += res.updated;
    if (res.recordBonus) total.recordBonus = res.recordBonus; // 마지막 소식만 — 잔액은 최신 값이면 된다
  }
  return total;
}

/**
 * 다운로드: 서버 → 로컬. 서버 entries를 받아 로컬에 맞춘다(새 기기·재설치 복원 + 다른 폰의 수정·삭제).
 * 서버 clientId → 로컬 SavedEntry.id로 복원 → store.applyServerEntries가 규칙대로 반영.
 */
export async function downloadJournal(
  token: string,
  /** 받는 사이 로그아웃·계정 전환이 있었으면 false — 남의 단어장을 이 폰에 섞지 않는다. */
  stillCurrent: () => boolean = () => true,
): Promise<number> {
  // 받기 시작한 순간 이미 서버에 있던 것 — 받는 사이 올라간 글을 "서버에 없다"고 지우지 않게.
  const { entries, dirtyIds } = useJournalStore.getState();
  const dirty = new Set(dirtyIds);
  const cleanAtStart = new Set(entries.filter((e) => !dirty.has(e.id)).map((e) => e.id));
  const serverEntries = await getJournal(token);
  if (!stillCurrent()) return 0;
  const restored: SavedEntry[] = serverEntries.map((e) => ({
    id: e.clientId,
    word: e.word,
    text: e.text,
    savedAt: e.savedAt,
    changeNote: e.changeNote ?? undefined, // 서버는 없을 때 null — 로컬 규칙(undefined)에 맞춘다
  }));
  useJournalStore.getState().applyServerEntries(restored, cleanAtStart);
  return restored.length;
}
