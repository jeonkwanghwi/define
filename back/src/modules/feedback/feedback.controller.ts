/**
 * FeedbackController — /api/feedback. JwtAuthGuard 보호.
 *
 * 로그인을 요구하는 이유: 인증 없는 메일 발송 엔드포인트는 그 자체로 스팸 통로다.
 * 덤으로 "누가 겪었는지"를 토큰에서 그냥 알 수 있다.
 */
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** POST /api/feedback — 버그 제보를 운영자 메일로 보낸다. 돌려줄 게 없어 204. */
  @Post()
  @HttpCode(204)
  submit(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateFeedbackDto,
  ): Promise<void> {
    return this.feedback.submit(req.user.userId, dto);
  }
}
