/**
 * AdsController — /api/ads/*.
 *
 * 두 라우트의 성격이 정반대라 가드를 **클래스가 아니라 라우트에** 붙인다:
 *   - ssv   : 구글이 부른다. JWT가 없다. **서명이 인증이다.**
 *   - quota : 우리 앱이 부른다. JWT 필수.
 */
import { Controller, Get, HttpCode, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdQuota, AdsService } from './ads.service';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  /**
   * GET /api/ads/ssv — AdMob이 광고 시청 완료를 알리는 콜백. **유일한 적립 경로다.**
   *
   * @Query()로 파싱된 객체를 쓰지 않는 이유: 서명 대상은 원본 쿼리스트링이고,
   * 파싱된 객체를 다시 조립하면 **순서와 인코딩이 달라져 서명이 반드시 깨진다.**
   * 그래서 @Req로 원본 url을 받아 '?' 뒤를 그대로 넘긴다.
   */
  @Get('ssv')
  @HttpCode(200)
  ssv(@Req() req: { originalUrl?: string; url: string }): Promise<void> {
    const url = req.originalUrl ?? req.url;
    return this.ads.grantFromSsv(url.slice(url.indexOf('?') + 1));
  }

  /** GET /api/ads/quota — 오늘 남은 횟수. 앱이 버튼 문구를 그리는 데 쓴다. */
  @Get('quota')
  @UseGuards(JwtAuthGuard)
  quota(@Req() req: { user: { userId: string } }): Promise<AdQuota> {
    return this.ads.getQuota(req.user.userId);
  }
}
