/**
 * RecallModule — 회상 한 덩어리. CurrencyModule import(차감), RecallRepository 바인딩.
 * JwtModule.registerAsync: 대화 토큰(이어하기 무료 판정) 서명·검증용 — auth와 동일 secret 재사용.
 * JwtAuthGuard의 'jwt' 전략은 AuthModule이 전역 등록하므로 그건 import 불필요.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { CurrencyModule } from '../currency/currency.module';
import { UsageModule } from '../usage/usage.module';
import { OpenAiClient } from './openai.client';
import { RecallController } from './recall.controller';
import { RecallRepository } from './recall.repository';
import { PrismaRecallRepository } from './recall.repository.prisma';
import { RecallService } from './recall.service';

@Module({
  imports: [
    CurrencyModule,
    UsageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [RecallController],
  providers: [
    RecallService,
    OpenAiClient,
    { provide: RecallRepository, useClass: PrismaRecallRepository },
  ],
})
export class RecallModule {}
