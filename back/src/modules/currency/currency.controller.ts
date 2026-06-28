/**
 * CurrencyController — /api/currency/*. JwtAuthGuard로 보호(토큰 필수).
 * req.user는 JwtStrategy.validate가 심은 { userId, email }.
 */
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AttendanceDto } from './dto/attendance.dto';
import { AttendanceResult, CurrencyService } from './currency.service';

@Controller('currency')
@UseGuards(JwtAuthGuard)
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) {}

  /** POST /api/currency/attendance — 앱 열 때 자동 출석 적립(하루 1회, 멱등). */
  @Post('attendance')
  @HttpCode(200)
  attendance(
    @Req() req: { user: { userId: string } },
    @Body() dto: AttendanceDto,
  ): Promise<AttendanceResult> {
    return this.currency.claimAttendance(req.user.userId, dto.localDate);
  }
}
