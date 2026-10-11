/**
 * WordModule — word 기능 한 덩어리를 묶는다(controller + service + repository).
 *
 * ★ 핵심 한 줄: providers의 { provide: WordRepository, useClass: PrismaWordRepository }
 *   = "WordRepository(계약)를 누가 달라고 하면 PrismaWordRepository(구현체)를 줘라".
 *   나중에 DB를 바꾸면 useClass만 다른 구현체로 교체 → service/controller는 손 안 댐.
 *   이게 우리가 원한 "인터페이스 의존 + config에서 스왑"의 실체.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { WordController } from './word.controller';
import { WordRepository } from './word.repository';
import { PrismaWordRepository } from './word.repository.prisma';
import { WordService } from './word.service';

@Module({
  // JwtModule: /words/recommended가 **선택적** 토큰을 직접 검증한다(가드 없이).
  // auth와 같은 secret을 재사용 — 토큰을 발급한 쪽이 auth라서다. RecallModule과 같은 배선.
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [WordController],
  providers: [
    WordService,
    { provide: WordRepository, useClass: PrismaWordRepository },
  ],
})
export class WordModule {}
