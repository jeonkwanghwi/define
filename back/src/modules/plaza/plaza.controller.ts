/**
 * PlazaController — /api/plaza/*. 모두 JwtAuthGuard(상호주의 = 로그인).
 * :word는 한글이라 클라가 encodeURIComponent로 보내고, @Param이 디코드해서 받는다.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  PlazaBlockedUsersResponse,
  PlazaLikeResponse,
  PlazaStatsResponse,
  PlazaWordDetailResponse,
  PlazaWordResponse,
} from './dto/plaza.response';
import { ReportEntryDto } from './dto/report-entry.dto';
import { PlazaService } from './plaza.service';

@Controller('plaza')
@UseGuards(JwtAuthGuard)
export class PlazaController {
  constructor(private readonly plaza: PlazaService) {}

  /** GET /api/plaza/words — 정의 있는 단어 목록(대표 정의 미리보기·활동순). */
  @Get('words')
  listWords(@Req() req: { user: { userId: string } }): Promise<PlazaWordResponse[]> {
    return this.plaza.listWords(req.user.userId);
  }

  /** GET /api/plaza/stats — 광장 상단 "이번 주" 통계. */
  @Get('stats')
  getStats(@Req() req: { user: { userId: string } }): Promise<PlazaStatsResponse> {
    return this.plaza.getStats(req.user.userId);
  }

  /**
   * GET /api/plaza/words/:word?offset=N — 한 단어의 정의 한 쪽(무한 스크롤).
   * offset 없이 부르는 옛 앱(빌드 10 이하)은 첫 쪽만 받는다 — 깨지지는 않는다.
   */
  @Get('words/:word')
  getWord(
    @Param('word') word: string,
    @Query('offset') offset: string | undefined,
    @Req() req: { user: { userId: string } },
  ): Promise<PlazaWordDetailResponse> {
    // 없으면 첫 쪽. 정수가 아니거나 범위 밖(1e20 등)이면 400 — 그대로 DB에 넘기면 500이 났다.
    // 쿼리 하나에 DTO 클래스를 만들 일은 아니다.
    const n = offset === undefined ? 0 : Number(offset);
    if (!Number.isSafeInteger(n) || n < 0 || n > 10_000) {
      throw new BadRequestException('offset이 올바르지 않아요.');
    }
    return this.plaza.getWord(word, req.user.userId, n);
  }

  /** POST /api/plaza/definitions/:entryId/like — 좋아요 토글(내 정의 불가). */
  @Post('definitions/:entryId/like')
  toggleLike(
    @Param('entryId') entryId: string,
    @Req() req: { user: { userId: string } },
  ): Promise<PlazaLikeResponse> {
    return this.plaza.toggleLike(req.user.userId, entryId);
  }

  /** POST /api/plaza/entries/:entryId/report — 정의 신고. 돌려줄 게 없어 204. */
  @Post('entries/:entryId/report')
  @HttpCode(204)
  report(
    @Param('entryId') entryId: string,
    @Req() req: { user: { userId: string } },
    @Body() dto: ReportEntryDto,
  ): Promise<void> {
    return this.plaza.report(req.user.userId, entryId, dto.reason);
  }

  /** POST /api/plaza/users/:userId/block — 이 사람 글을 내 광장에서 치운다. */
  @Post('users/:userId/block')
  @HttpCode(204)
  block(
    @Param('userId') blockedId: string,
    @Req() req: { user: { userId: string } },
  ): Promise<void> {
    return this.plaza.block(req.user.userId, blockedId);
  }

  /** DELETE /api/plaza/users/:userId/block — 차단 해제. */
  @Delete('users/:userId/block')
  @HttpCode(204)
  unblock(
    @Param('userId') blockedId: string,
    @Req() req: { user: { userId: string } },
  ): Promise<void> {
    return this.plaza.unblock(req.user.userId, blockedId);
  }

  /** GET /api/plaza/blocks — 내가 차단한 사람들(마이페이지에서 해제하려면 목록이 필요하다). */
  @Get('blocks')
  listBlocks(
    @Req() req: { user: { userId: string } },
  ): Promise<PlazaBlockedUsersResponse> {
    return this.plaza.listBlocked(req.user.userId);
  }
}
