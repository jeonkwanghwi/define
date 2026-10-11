/**
 * PrismaWordRepository — WordRepository 계약의 "SQLite(Prisma) 구현체".
 *
 * 여기서만 Prisma를 안다. DB row → WordEntity로 변환해서 돌려준다.
 * 나중에 Postgres로 가면 이 파일은 거의 그대로(Prisma가 흡수),
 * Mongo로 가면 이 파일만 새로 쓰고 module 바인딩을 바꾼다.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { WordEntity } from './entities/word.entity';
import { WordRepository } from './word.repository';

@Injectable()
export class PrismaWordRepository extends WordRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(): Promise<WordEntity[]> {
    const rows = await this.prisma.word.findMany({
      orderBy: { createdAt: 'asc' },
    });
    // DB row를 도메인 객체로 변환(필요한 필드만 노출).
    return rows.map((row) => ({ id: row.id, text: row.text, tags: row.tags }));
  }

  async findActive(): Promise<WordEntity[]> {
    const rows = await this.prisma.word.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({ id: row.id, text: row.text, tags: row.tags }));
  }

  async findInterests(userId: string): Promise<string[]> {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      select: { interest: true },
    });
    return rows.map((row) => row.interest);
  }

  async findDefinedWordsSince(userId: string, since: Date): Promise<string[]> {
    // distinct로 DB에서 중복을 접는다 — 같은 단어를 여러 번 재정의한 사람이 있다.
    const rows = await this.prisma.entry.findMany({
      where: { userId, savedAt: { gte: since } },
      select: { word: true },
      distinct: ['word'],
    });
    return rows.map((row) => row.word);
  }
}
