/**
 * journal-api — 로컬 단어장 서버 업로드. POST /api/journal/import (Bearer 필요).
 * 백엔드가 (userId, clientId) 멱등 upsert → 같은 payload 재전송해도 중복 안 쌓임.
 */
import { apiRequest } from './api-client';

/** 서버로 보내는 entry 한 개. 로컬 SavedEntry.id가 clientId로 보존된다. */
export type ImportEntry = {
  clientId: string;
  word: string;
  text: string;
  changeNote?: string;
  savedAt: string; // ISO
};

export type ImportResult = {
  imported: number;
  updated: number;
};

/** POST /api/journal/import */
export function importJournal(token: string, entries: ImportEntry[]): Promise<ImportResult> {
  return apiRequest<ImportResult>('/journal/import', {
    method: 'POST',
    token,
    body: { entries },
  });
}
