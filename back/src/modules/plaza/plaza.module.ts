/**
 * PlazaModule — 광장 한 덩어리. PlazaRepository 계약↔Prisma 구현 바인딩.
 * JwtAuthGuard의 'jwt' 전략은 AuthModule이 전역 등록하므로 여기서 import 불필요.
 */
import { Module } from '@nestjs/common';

import { PlazaController } from './plaza.controller';
import { PlazaRepository } from './plaza.repository';
import { PrismaPlazaRepository } from './plaza.repository.prisma';
import { PlazaService } from './plaza.service';

@Module({
  controllers: [PlazaController],
  providers: [
    PlazaService,
    { provide: PlazaRepository, useClass: PrismaPlazaRepository },
  ],
})
export class PlazaModule {}
