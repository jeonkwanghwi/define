/**
 * VillageModule — 마을 한 덩어리. VillageRepository 계약↔Prisma 구현 바인딩.
 * JwtAuthGuard의 'jwt' 전략은 AuthModule이 전역 등록하므로 여기서 import 불필요.
 */
import { Module } from '@nestjs/common';

import { VillageController } from './village.controller';
import { VillageRepository } from './village.repository';
import { PrismaVillageRepository } from './village.repository.prisma';
import { VillageService } from './village.service';

@Module({
  controllers: [VillageController],
  providers: [
    VillageService,
    { provide: VillageRepository, useClass: PrismaVillageRepository },
  ],
})
export class VillageModule {}
