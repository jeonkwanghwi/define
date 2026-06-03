/**
 * PrismaService — DB 접근 클라이언트.
 *
 * PrismaClient를 상속해 NestJS의 생명주기에 연결한다:
 *   - onModuleInit:   앱 시작 시 DB 연결
 *   - onModuleDestroy: 앱 종료 시 연결 정리
 *
 * 다른 곳에서는 이걸 직접 쓰지 않고, repository 구현체 안에서만 사용한다.
 * (service는 repository 인터페이스만 알고, DB가 Prisma인지조차 모르게.)
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
