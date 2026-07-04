/**
 * PlazaController — /api/plaza/*. 모두 JwtAuthGuard(상호주의 = 로그인).
 * :word는 한글이라 클라가 encodeURIComponent로 보내고, @Param이 디코드해서 받는다.
 */
import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  PlazaLikeResponse,
  PlazaStatsResponse,
  PlazaWordDetailResponse,
  PlazaWordResponse,
} from './dto/plaza.response';
import { PlazaService } from './plaza.service';

@Controller('plaza')
@UseGuards(JwtAuthGuard)
export class PlazaController {
  constructor(private readonly plaza: PlazaService) {}

  /** GET /api/plaza/words — 정의 있는 단어 목록(대표 정의 미리보기·활동순). */
  @Get('words')
  listWords(): Promise<PlazaWordResponse[]> {
    return this.plaza.listWords();
  }

  /** GET /api/plaza/stats — 광장 상단 "이번 주" 통계. */
  @Get('stats')
  getStats(@Req() req: { user: { userId: string } }): Promise<PlazaStatsResponse> {
    return this.plaza.getStats(req.user.userId);
  }

  /** GET /api/plaza/words/:word — 한 단어의 정의들(내 정의 강조). */
  @Get('words/:word')
  getWord(
    @Param('word') word: string,
    @Req() req: { user: { userId: string } },
  ): Promise<PlazaWordDetailResponse> {
    return this.plaza.getWord(word, req.user.userId);
  }

  /** POST /api/plaza/definitions/:entryId/like — 좋아요 토글(내 정의 불가). */
  @Post('definitions/:entryId/like')
  toggleLike(
    @Param('entryId') entryId: string,
    @Req() req: { user: { userId: string } },
  ): Promise<PlazaLikeResponse> {
    return this.plaza.toggleLike(req.user.userId, entryId);
  }
}
