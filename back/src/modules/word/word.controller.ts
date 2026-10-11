/**
 * WordController — HTTP 계층. URL과 메서드를 service 호출에 연결만 한다(얇게).
 *
 * @Controller('words') + 전역 프리픽스 'api' → 이 컨트롤러의 기준 경로는 /api/words.
 * @Get() → GET 요청을 findAll()에 매핑.
 *
 * 로직은 일절 두지 않는다(검증은 dto, 규칙은 service). 컨트롤러는 "교통정리"만.
 */
import { Controller, Get, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { RecommendedWordsResponse, WordResponse } from './dto/word.response';
import { WordService } from './word.service';

/** 앱이 한 번에 받아 가는 풀 크기. 앱은 이 안에서 "다시 뽑기"를 돌린다. */
const DEFAULT_LIMIT = 30;

@Controller('words')
export class WordController {
  constructor(
    private readonly wordService: WordService,
    private readonly jwt: JwtService,
  ) {}

  /** GET /api/words — 추천 단어 목록. */
  @Get()
  findAll(): Promise<WordResponse[]> {
    return this.wordService.listWords();
  }

  /**
   * GET /api/words/recommended?limit=30 — 홈의 "오늘의 단어" 풀.
   *
   * **JWT는 선택이다.** 홈은 로그인 없이도 쓰는 화면이라 토큰이 없다고 401을 줄 수 없는데,
   * JwtAuthGuard는 토큰이 없으면 거부한다. "선택" 가드를 새로 만드는 대신 여기서
   * Authorization 헤더를 직접 해석한다 — 필요한 건 userId 하나이고, 실패하면
   * (없음·만료·위조) 그냥 비로그인으로 취급하면 되기 때문이다.
   */
  @Get('recommended')
  async recommended(
    @Req() req: { headers: { authorization?: string } },
    @Query('limit') limit?: string,
  ): Promise<RecommendedWordsResponse> {
    const userId = await this.userIdOrNull(req.headers.authorization);
    // 0·음수·문자열이 들어와도 최소 1개는 내려간다(빈 홈 방지).
    const size = Math.max(1, Number(limit) || DEFAULT_LIMIT);
    return this.wordService.recommend(userId, size);
  }

  /** Bearer 토큰에서 userId를 꺼낸다. 토큰이 없거나 검증에 실패하면 null(=비로그인). */
  private async userIdOrNull(authorization?: string): Promise<string | null> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      return payload.sub;
    } catch {
      return null;
    }
  }
}
