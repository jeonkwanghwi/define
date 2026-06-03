/**
 * DatabaseModule — PrismaService를 앱 전역에 제공한다.
 *
 * @Global() 덕분에 다른 모듈이 imports에 일일이 안 넣어도 PrismaService를 주입받을 수 있다.
 * DB 연결처럼 모두가 쓰는 공용 자원에 적합.
 */
import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
