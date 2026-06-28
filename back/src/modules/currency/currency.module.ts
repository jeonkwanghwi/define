/**
 * CurrencyModule — 재화(잉크) 한 덩어리. CurrencyRepository 계약↔Prisma 구현 바인딩.
 * JwtAuthGuard가 쓰는 'jwt' 전략은 AuthModule이 전역 등록하므로 여기서 import 불필요.
 */
import { Module } from '@nestjs/common';

import { CurrencyController } from './currency.controller';
import { CurrencyRepository } from './currency.repository';
import { PrismaCurrencyRepository } from './currency.repository.prisma';
import { CurrencyService } from './currency.service';

@Module({
  controllers: [CurrencyController],
  providers: [
    CurrencyService,
    { provide: CurrencyRepository, useClass: PrismaCurrencyRepository },
  ],
})
export class CurrencyModule {}
