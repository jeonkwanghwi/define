/**
 * AppModule — 루트 모듈. 앱을 구성하는 모듈들을 한데 등록한다.
 *
 *   - ConfigModule: .env를 읽어 전역 설정 제공 (isGlobal: 어디서나 ConfigService 주입)
 *   - DatabaseModule: PrismaService 전역 제공
 *   - WordModule: 첫 기능(추천 단어)
 *
 * 새 기능(journal, auth, plaza...)을 만들면 여기 imports에 모듈을 추가해 나간다.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { WordModule } from './modules/word/word.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    WordModule,
  ],
})
export class AppModule {}
