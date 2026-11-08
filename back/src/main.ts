/**
 * 앱 진입점(부트스트랩). `npm run start:dev` 시 가장 먼저 실행된다.
 *
 * 하는 일:
 *   1. AppModule을 루트로 NestJS 앱 인스턴스 생성
 *   2. 전역 ValidationPipe — 들어오는 요청(dto)을 자동 검증·정제
 *   3. 모든 라우트에 /api 프리픽스 (예: GET /api/words)
 *   4. 포트 listen
 */
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import { ClientErrorFilter } from './common/client-error.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // trust proxy 2 — req.ip를 "사용자 IP"로 만든다(IP 레이트 리밋이 이 값을 쓴다).
  // 요청은 사용자 → CloudFront → API Gateway(VPC Link) → 여기로 온다. X-Forwarded-For는 끝에서부터
  //   [..., 사용자 IP(CloudFront가 붙임), CloudFront IP(API Gateway가 붙임)]
  // (API Gateway 경로에선 아래 오리진 비밀 헤더 미들웨어가 x-cf-forwarded-for를 제자리에 돌려놓는다.)
  // 라서 오른쪽에서 두 칸을 믿으면 사용자 IP가 나온다. 그보다 왼쪽은 사용자가 마음대로
  // 써 보낼 수 있는 값이라 믿으면 안 된다. 로컬처럼 프록시가 없으면 소켓 주소가 그대로 쓰인다.
  // ⚠️ CloudFront를 거친 요청만 받아야 성립한다 — 오리진 비밀 헤더(x-origin-secret) 검사가 그 잠금이다.
  app.set('trust proxy', 2);

  // CORS — 브라우저(expo web :8081 등)에서 교차 출처로 API 호출 허용.
  // 운영에선 CORS_ORIGINS에 프론트 도메인만 콤마로 나열(화이트리스트).
  //   예) CORS_ORIGINS="https://define.example.com,https://d123.cloudfront.net"
  // 미설정이면 origin: true = 요청 출처를 그대로 반영(로컬 개발 편의).
  // 인증은 Authorization: Bearer 헤더라 cors 기본 allowedHeaders(요청 헤더 반영)로 통과됨.
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins?.length ? corsOrigins : true });

  // JSON 본문 상한 2mb. 기본값 100kb면 단어장이 큰 사용자의 동기화가 413으로 영원히 실패한다.
  // (앱은 200개씩 나눠 보낸다. 한글 1자 ≈ 3바이트라 정의 평균 1000자여도 200개 ≈ 0.6mb.)
  app.useBodyParser('json', { limit: '2mb' });

  // 오리진 비밀 헤더 — CloudFront를 건너뛴 요청을 막는다.
  // API Gateway 주소는 공개라 누구나 직접 부를 수 있다. 그러면 X-Forwarded-For를 위조해
  // IP 레이트 리밋(trust proxy 2)을 우회할 수 있다. CloudFront만 오리진 요청에
  // x-origin-secret을 붙이므로, 이 값이 없거나 틀리면 거절한다.
  // /api/health는 예외 — 컨테이너 헬스체크가 localhost에서 헤더 없이 부른다.
  // ORIGIN_SECRET이 없으면(로컬 개발) 검사하지 않는다.
  const originSecret = process.env.ORIGIN_SECRET;
  if (originSecret) {
    const expected = Buffer.from(originSecret);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/api/health') return next();
      const got = Buffer.from(String(req.headers['x-origin-secret'] ?? ''));
      if (got.length === expected.length && timingSafeEqual(got, expected)) {
        // API Gateway는 X-Forwarded-For를 넘기지 않는다(헤더 조작도 금지). 대신 통합 설정에서
        // 그 값을 x-cf-forwarded-for로 옮겨 준다: [..., 사용자 IP(CloudFront), CloudFront IP(API GW)].
        // ALB가 넘기던 형식과 같아서 제자리에 돌려놓으면 아래 trust proxy 2가 그대로 맞는다.
        // 비밀 헤더 검사를 통과한 요청만 — API GW가 덮어쓰므로 사용자가 위조할 수 없다.
        const viaApiGw = req.headers['x-cf-forwarded-for'];
        if (typeof viaApiGw === 'string') req.headers['x-forwarded-for'] = viaApiGw;
        return next();
      }
      res.status(403).json({ statusCode: 403, message: 'Forbidden' });
    });
  }

  // Express가 응답마다 "X-Powered-By: Express"를 붙인다 — 공격자에게 서버 종류만 알려줄 뿐이다.
  app.disable('x-powered-by');

  // whitelist: dto에 없는 필드는 잘라냄 / transform: 타입 자동 변환
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 본문 오류(413·깨진 JSON)는 4xx 응답만 — ERROR 로그(= 장애 알람)로 세지 않는다.
  app.useGlobalFilters(new ClientErrorFilter(app.get(HttpAdapterHost).httpAdapter));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`define API listening on http://localhost:${port}/api`);
}

bootstrap();
