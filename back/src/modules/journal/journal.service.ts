/**
 * JournalService — 로컬 entries를 서버로 동기화(import).
 * 각 entry를 (userId, clientId) 멱등 upsert → 신규는 imported, 기존은 updated로 집계.
 * 같은 payload를 두 번 보내도 imported=0이 되어 중복이 안 쌓이는 게 핵심 계약.
 */
import { BadRequestException, Injectable } from '@nestjs/common';

import { CurrencyService, RecordBonus } from '../currency/currency.service';
import { ImportJournalDto } from './dto/import-journal.dto';
import { EntryRecord, EntryRepository } from './entry.repository';
import { computeRecordStreak } from './record-streak';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 이보다 옛날 savedAt은 기기 시계 오류이거나 조작이다(앱 출시 훨씬 전). */
const MIN_SAVED_AT = Date.parse('2000-01-01T00:00:00Z');

@Injectable()
export class JournalService {
  constructor(
    private readonly entries: EntryRepository,
    private readonly currency: CurrencyService,
  ) {}

  async import(
    userId: string,
    dto: ImportJournalDto,
  ): Promise<{ imported: number; updated: number; recordBonus?: RecordBonus }> {
    // savedAt은 기기가 보낸 값이라 믿을 수 없다. 미래 날짜(예: 9999년)를 허용하면 광장 정렬 맨 위를
    // 영원히 차지할 수 있었다. 시간대 차이를 감안해 "서버 지금 + 1일"까지만 받는다.
    // 하나라도 어긋나면 아무것도 쓰기 전에 거절한다(일부만 들어가는 반쪽 상태를 만들지 않게).
    const maxSavedAt = Date.now() + DAY_MS;
    for (const e of dto.entries) {
      const t = Date.parse(e.savedAt);
      if (t > maxSavedAt || t < MIN_SAVED_AT) {
        throw new BadRequestException('기록 날짜가 올바르지 않아요.');
      }
    }

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

    // 업서트 후 현재 연속 기록일로 보너스 계산(멱등).
    // 날짜는 savedAt(기기가 보낸 값)이 아니라 createdAt(**서버가 처음 받은 시각**)으로 센다.
    // savedAt으로 세면 날짜만 하루씩 바꾼 가짜 기록 400개로 한 번에 잉크 830개를 찍어낼 수 있었다.
    // 대가: 가입 전에 폰에만 쌓인 기록은 전부 가입한 날 하루로 잡힌다(그날부터 매일 쓰면 다시 쌓인다).
    const streak = computeRecordStreak(await this.entries.findCreatedAtByUserId(userId));
    const recordBonus = (await this.currency.grantRecordMilestone(userId, streak)) ?? undefined;

    return { imported, updated, recordBonus };
  }

  /** 다운로드 동기화 — 한 사용자의 서버 entries 전체(최신순). */
  list(userId: string): Promise<EntryRecord[]> {
    return this.entries.findByUserId(userId);
  }

  /** 삭제 동기화 — (userId, clientId) entry 제거. 멱등. */
  delete(userId: string, clientId: string): Promise<void> {
    return this.entries.deleteByClientId(userId, clientId);
  }
}
