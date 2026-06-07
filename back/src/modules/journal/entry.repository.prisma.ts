/**
 * PrismaEntryRepository — EntryRepository의 Prisma 구현.
 * Prisma의 upsert는 "생성/갱신 여부"를 반환하지 않으므로,
 * 멱등성 카운트(imported/updated)를 정확히 내려면 findUnique로 먼저 확인 후 분기한다.
 * 복합 유니크 키 입력 이름은 Prisma가 자동 생성한 `userId_clientId`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { EntryInput, EntryRepository } from './entry.repository';

@Injectable()
export class PrismaEntryRepository extends EntryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsert(userId: string, input: EntryInput): Promise<{ created: boolean }> {
    const existing = await this.prisma.entry.findUnique({
      where: { userId_clientId: { userId, clientId: input.clientId } },
    });

    const data = {
      word: input.word,
      text: input.text,
      changeNote: input.changeNote ?? null,
      savedAt: input.savedAt,
    };

    if (existing) {
      await this.prisma.entry.update({ where: { id: existing.id }, data });
      return { created: false };
    }

    await this.prisma.entry.create({
      data: { userId, clientId: input.clientId, ...data },
    });
    return { created: true };
  }
}
