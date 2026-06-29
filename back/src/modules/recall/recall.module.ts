/**
 * RecallModule — 회상 한 덩어리. CurrencyModule import(차감), RecallRepository 바인딩.
 * JwtAuthGuard의 'jwt' 전략은 AuthModule이 전역 등록하므로 import 불필요.
 */
import { Module } from '@nestjs/common';

import { CurrencyModule } from '../currency/currency.module';
import { OpenAiClient } from './openai.client';
import { RecallController } from './recall.controller';
import { RecallRepository } from './recall.repository';
import { PrismaRecallRepository } from './recall.repository.prisma';
import { RecallService } from './recall.service';

@Module({
  imports: [CurrencyModule],
  controllers: [RecallController],
  providers: [
    RecallService,
    OpenAiClient,
    { provide: RecallRepository, useClass: PrismaRecallRepository },
  ],
})
export class RecallModule {}
