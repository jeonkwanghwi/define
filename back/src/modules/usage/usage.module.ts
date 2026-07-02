/**
 * UsageModule — LLM 사용량·비용 중앙 원장. UsageService를 export해 회상 등 AI 기능이 주입.
 * PrismaService는 전역 DatabaseModule 제공 → import 불필요.
 */
import { Module } from '@nestjs/common';

import { UsageRepository } from './usage.repository';
import { PrismaUsageRepository } from './usage.repository.prisma';
import { UsageService } from './usage.service';

@Module({
  providers: [UsageService, { provide: UsageRepository, useClass: PrismaUsageRepository }],
  exports: [UsageService],
})
export class UsageModule {}
