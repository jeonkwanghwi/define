/**
 * PlazaController — /api/plaza/*. 모두 JwtAuthGuard(상호주의 = 로그인).
 * :word는 한글이라 클라가 encodeURIComponent로 보내고, @Param이 디코드해서 받는다.
 */
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  PlazaWordDetailResponse,
  PlazaWordResponse,
} from './dto/plaza.response';
import { PlazaService } from './plaza.service';

@Controller('plaza')
@UseGuards(JwtAuthGuard)
export class PlazaController {
  constructor(private readonly plaza: PlazaService) {}

  /** GET /api/plaza/words — 정의 있는 단어 목록. */
  @Get('words')
  listWords(): Promise<PlazaWordResponse[]> {
    return this.plaza.listWords();
  }

  /** GET /api/plaza/words/:word — 한 단어의 정의들(내 정의 강조). */
  @Get('words/:word')
  getWord(
    @Param('word') word: string,
    @Req() req: { user: { userId: string } },
  ): Promise<PlazaWordDetailResponse> {
    return this.plaza.getWord(word, req.user.userId);
  }
}
