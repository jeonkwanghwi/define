/**
 * JournalController — /api/journal/import. JwtAuthGuard로 보호(토큰 필수).
 * req.user는 JwtStrategy.validate가 심은 { userId, email }.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportJournalDto } from './dto/import-journal.dto';
import { EntryRecord } from './entry.repository';
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

  /** GET /api/journal — 내 단어장 전체(다운로드 동기화: 새 기기·재설치 복원용). */
  @Get()
  list(@Req() req: { user: { userId: string } }): Promise<EntryRecord[]> {
    return this.journal.list(req.user.userId);
  }

  /** DELETE /api/journal/:clientId — 한 entry 삭제 동기화(멱등, 204). */
  @Delete(':clientId')
  @HttpCode(204)
  remove(
    @Req() req: { user: { userId: string } },
    @Param('clientId') clientId: string,
  ): Promise<void> {
    return this.journal.delete(req.user.userId, clientId);
  }
}
