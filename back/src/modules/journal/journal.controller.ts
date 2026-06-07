/**
 * JournalController — /api/journal/import. JwtAuthGuard로 보호(토큰 필수).
 * req.user는 JwtStrategy.validate가 심은 { userId, email }.
 */
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportJournalDto } from './dto/import-journal.dto';
import { JournalService } from './journal.service';

@Controller('journal')
@UseGuards(JwtAuthGuard)
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  /** POST /api/journal/import — 로컬 단어장 업로드(가입 직후 1회). */
  @Post('import')
  @HttpCode(200)
  import(
    @Req() req: { user: { userId: string } },
    @Body() dto: ImportJournalDto,
  ): Promise<{ imported: number; updated: number }> {
    return this.journal.import(req.user.userId, dto);
  }
}
