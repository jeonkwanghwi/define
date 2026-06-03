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
    return rows.map((row) => ({ id: row.id, text: row.text }));
  }
}
