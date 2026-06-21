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

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — 브라우저(expo web :8081 등)에서 교차 출처로 API 호출 허용.
  // origin: true = 요청 출처를 그대로 반영(개발 편의). 운영에선 허용 도메인 화이트리스트로 제한할 것.
  // 인증은 Authorization: Bearer 헤더라 cors 기본 allowedHeaders(요청 헤더 반영)로 통과됨.
  app.enableCors({ origin: true });

  // whitelist: dto에 없는 필드는 잘라냄 / transform: 타입 자동 변환
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`define API listening on http://localhost:${port}/api`);
}

bootstrap();
