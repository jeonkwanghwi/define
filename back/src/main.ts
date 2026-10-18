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
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // trust proxy 2 — req.ip를 "사용자 IP"로 만든다(IP 레이트 리밋이 이 값을 쓴다).
  // 요청은 사용자 → CloudFront → ALB → 여기로 온다. X-Forwarded-For는 끝에서부터
  //   [..., 사용자 IP(CloudFront가 붙임), CloudFront IP(ALB가 붙임)]
  // 라서 오른쪽에서 두 칸을 믿으면 사용자 IP가 나온다. 그보다 왼쪽은 사용자가 마음대로
  // 써 보낼 수 있는 값이라 믿으면 안 된다. 로컬처럼 프록시가 없으면 소켓 주소가 그대로 쓰인다.
  // ⚠️ ALB가 CloudFront에서만 요청을 받도록 잠겨 있어야 성립한다(보안그룹 = CloudFront 프리픽스 리스트).
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

  // Express가 응답마다 "X-Powered-By: Express"를 붙인다 — 공격자에게 서버 종류만 알려줄 뿐이다.
  app.disable('x-powered-by');

  // whitelist: dto에 없는 필드는 잘라냄 / transform: 타입 자동 변환
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`define API listening on http://localhost:${port}/api`);
}

bootstrap();
