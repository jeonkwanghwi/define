/**
 * VillageController — /api/village/*. JwtAuthGuard 필수(가입해야 들어오는 탭).
 * req.user는 JwtStrategy.validate가 심은 { userId, email }.
 */
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NeighborsQueryDto } from './dto/neighbors-query.dto';
import { VillageNeighborsResponse } from './dto/village.response';
import { VillageService } from './village.service';

@Controller('village')
@UseGuards(JwtAuthGuard)
export class VillageController {
  constructor(private readonly village: VillageService) {}

  /** GET /api/village/neighbors?count=30 — 집에 앉힐 이웃 표본(본인 제외, 매번 랜덤 순서). */
  @Get('neighbors')
  listNeighbors(
    @Req() req: { user: { userId: string } },
    @Query() query: NeighborsQueryDto,
  ): Promise<VillageNeighborsResponse> {
    return this.village.listNeighbors(req.user.userId, query.count);
  }
}
