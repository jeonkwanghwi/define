/**
 * WordModule — word 기능 한 덩어리를 묶는다(controller + service + repository).
 *
 * ★ 핵심 한 줄: providers의 { provide: WordRepository, useClass: PrismaWordRepository }
 *   = "WordRepository(계약)를 누가 달라고 하면 PrismaWordRepository(구현체)를 줘라".
 *   나중에 DB를 바꾸면 useClass만 다른 구현체로 교체 → service/controller는 손 안 댐.
 *   이게 우리가 원한 "인터페이스 의존 + config에서 스왑"의 실체.
 */
import { Module } from '@nestjs/common';

import { WordController } from './word.controller';
import { WordRepository } from './word.repository';
import { PrismaWordRepository } from './word.repository.prisma';
import { WordService } from './word.service';

@Module({
  controllers: [WordController],
  providers: [
    WordService,
    { provide: WordRepository, useClass: PrismaWordRepository },
  ],
})
export class WordModule {}
