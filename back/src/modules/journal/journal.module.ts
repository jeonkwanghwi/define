/**
 * JournalModule — journal 한 덩어리. EntryRepository 계약↔Prisma 구현 바인딩.
 * JwtAuthGuard가 쓰는 'jwt' 전략은 AuthModule이 전역 등록하므로 여기서 import 불필요.
 */
import { Module } from '@nestjs/common';

import { CurrencyModule } from '../currency/currency.module';
import { EntryRepository } from './entry.repository';
import { PrismaEntryRepository } from './entry.repository.prisma';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  imports: [CurrencyModule],
  controllers: [JournalController],
  providers: [
    JournalService,
    { provide: EntryRepository, useClass: PrismaEntryRepository },
  ],
})
export class JournalModule {}
