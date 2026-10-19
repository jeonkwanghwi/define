/**
 * 요청 본문 오류(크기 초과 413 · 깨진 JSON 400)를 "사용자 실수"로 응답만 하고 ERROR로 남기지 않는다.
 *
 * 왜: body-parser가 던지는 이 에러들은 Nest의 HttpException이 아니라서, 기본 처리기가
 * "처리 못 한 예외"로 보고 ERROR 로그를 찍는다. 운영 알람(define-api-error-logs)이 ERROR 로그를 세므로
 * 토큰 없이 큰 본문 한 번만 보내도 누구나 장애 알림을 울릴 수 있었다(2026-10-20 운영 점검에서 발견).
 *
 * 어떻게: body-parser 에러에는 `status`(4xx)와 `expose: true`가 붙어 온다 — 그 경우만 HttpException으로
 * 바꿔 넘긴다. 나머지(진짜 서버 오류)는 그대로 기본 처리기에 맡겨 ERROR로 남는다.
 */
import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class ClientErrorFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const e = exception as { status?: unknown; expose?: unknown; message?: unknown };
    if (
      !(exception instanceof HttpException) &&
      typeof e?.status === 'number' &&
      e.status >= 400 &&
      e.status < 500 &&
      e.expose === true
    ) {
      const message = e.status === 413 ? '요청이 너무 커요.' : '요청 형식이 올바르지 않아요.';
      return super.catch(new HttpException(message, e.status), host);
    }
    return super.catch(exception, host);
  }
}
