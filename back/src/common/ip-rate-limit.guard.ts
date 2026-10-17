/**
 * IpRateLimit — 같은 IP가 한 엔드포인트를 정해진 시간 안에 N번까지만 부르게 한다.
 *
 * 왜 필요한가: 인증 없는 엔드포인트(로그인·인증번호 발송)는 누구나 부를 수 있다.
 *   - 인증번호: 주소를 바꿔가며 부르면 (이메일 단위) 제한에 안 걸리고, 전역 차단기(300/일)가
 *     바닥나 **정상 사용자의 가입이 막힌다.**
 *   - 로그인: 비밀번호를 무한정 대입할 수 있다.
 * 그래서 "누가 부르는가"를 IP로 묶어 센다.
 *
 * IP는 `req.ip`를 쓴다. 이 값이 진짜 사용자 IP가 되려면 main.ts의 `trust proxy` 설정과
 * ALB가 CloudFront에서만 요청을 받도록 잠겨 있어야 한다(둘 중 하나라도 빠지면 헤더 위조로 우회된다).
 *
 * 사용법: `@UseGuards(new IpRateLimit(20, DAY_MS))` — 인스턴스마다 카운터가 따로라 라우트별로 독립.
 *
 * ponytail: 카운터가 메모리에 있다 → ECS 태스크가 1개라 맞다. 태스크를 2개 이상으로 늘리면
 *   태스크마다 따로 세서 한도가 N배가 된다. 그때 Redis(ElastiCache)나 DB 테이블로 옮길 것.
 *   재배포하면 카운터가 초기화되는 것도 같은 이유 — 지금 규모에선 문제 없다.
 */
import { CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export class IpRateLimit implements CanActivate {
  /** IP → 창(window) 안에서 호출한 시각들. */
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const ip = ctx.switchToHttp().getRequest<{ ip?: string }>().ip ?? 'unknown';
    if (!this.take(ip, Date.now())) {
      // 이메일 쪽 429와 같은 문구 — 앱은 이미 이 문구를 그대로 보여준다.
      throw new HttpException('잠시 후에 다시 시도해 주세요.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  /** 한 번 쓸 수 있으면 기록하고 true. 테스트에서 시각을 넣어 부를 수 있게 분리했다. */
  take(ip: string, now: number): boolean {
    const since = now - this.windowMs;
    const recent = (this.hits.get(ip) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(ip, recent);
    // 다시 안 오는 IP가 쌓이지 않게, 커지면 창이 지난 항목을 한 번에 비운다.
    if (this.hits.size > 10_000) {
      for (const [k, ts] of this.hits) if (ts[ts.length - 1] <= since) this.hits.delete(k);
    }
    return true;
  }
}
