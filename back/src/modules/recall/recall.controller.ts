/**
 * RecallController — /api/recall/*. JwtAuthGuard 보호(가입 필요 탭).
 * req.user는 JwtStrategy.validate가 심은 { userId, email }.
 */
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecallChatDto } from './dto/recall-chat.dto';
import { RecallService } from './recall.service';

@Controller('recall')
@UseGuards(JwtAuthGuard)
export class RecallController {
  constructor(private readonly recall: RecallService) {}

  /** POST /api/recall/consent — AI 데이터 동의 기록. */
  @Post('consent')
  @HttpCode(200)
  consent(@Req() req: { user: { userId: string } }): Promise<{ recallConsentAt: string }> {
    return this.recall.consent(req.user.userId);
  }

  /** POST /api/recall/chat — 과거의 나와 1턴 대화(새 대화면 30잉크 차감). */
  @Post('chat')
  @HttpCode(200)
  chat(
    @Req() req: { user: { userId: string } },
    @Body() dto: RecallChatDto,
  ): Promise<{ message: string; balance: number }> {
    return this.recall.chat(req.user.userId, dto);
  }
}
