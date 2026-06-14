/**
 * JournalService — 로컬 entries를 서버로 동기화(import).
 * 각 entry를 (userId, clientId) 멱등 upsert → 신규는 imported, 기존은 updated로 집계.
 * 같은 payload를 두 번 보내도 imported=0이 되어 중복이 안 쌓이는 게 핵심 계약.
 */
import { Injectable } from '@nestjs/common';

import { ImportJournalDto } from './dto/import-journal.dto';
import { EntryRecord, EntryRepository } from './entry.repository';

@Injectable()
export class JournalService {
  constructor(private readonly entries: EntryRepository) {}

  async import(
    userId: string,
    dto: ImportJournalDto,
  ): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;

    for (const e of dto.entries) {
      const { created } = await this.entries.upsert(userId, {
        clientId: e.clientId,
        word: e.word,
        text: e.text,
        changeNote: e.changeNote,
        savedAt: new Date(e.savedAt),
      });
      if (created) {
        imported += 1;
      } else {
        updated += 1;
      }
    }

    return { imported, updated };
  }

  /** 다운로드 동기화 — 한 사용자의 서버 entries 전체(최신순). */
  list(userId: string): Promise<EntryRecord[]> {
    return this.entries.findByUserId(userId);
  }
}
