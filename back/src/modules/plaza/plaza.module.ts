/**
 * PlazaModule — 광장 한 덩어리. PlazaRepository 계약↔Prisma 구현 바인딩.
 * AuthModule은 MailService 때문에 import한다(신고 → 운영자 메일).
 */
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PlazaController } from './plaza.controller';
import { PlazaRepository } from './plaza.repository';
import { PrismaPlazaRepository } from './plaza.repository.prisma';
import { PlazaService } from './plaza.service';

@Module({
  // MailService(신고 알림 메일)를 쓰려고 — FeedbackModule과 같은 배선.
  imports: [AuthModule],
  controllers: [PlazaController],
  providers: [
    PlazaService,
    { provide: PlazaRepository, useClass: PrismaPlazaRepository },
  ],
})
export class PlazaModule {}
