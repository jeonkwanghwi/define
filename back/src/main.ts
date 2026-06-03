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

  // whitelist: dto에 없는 필드는 잘라냄 / transform: 타입 자동 변환
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`define API listening on http://localhost:${port}/api`);
}

bootstrap();
