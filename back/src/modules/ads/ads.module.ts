/**
 * AdsModule — 보상형 광고 한 덩어리. AdRewardRepository 계약↔Prisma 구현 바인딩.
 * JwtAuthGuard가 쓰는 'jwt' 전략은 AuthModule이 전역 등록하므로 여기서 import 불필요.
 */
import { Module } from '@nestjs/common';

import { AdRewardRepository } from './ad-reward.repository';
import { PrismaAdRewardRepository } from './ad-reward.repository.prisma';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { SsvKeyCache } from './ssv-verifier';

@Module({
  controllers: [AdsController],
  providers: [
    AdsService,
    SsvKeyCache,
    { provide: AdRewardRepository, useClass: PrismaAdRewardRepository },
  ],
})
export class AdsModule {}
