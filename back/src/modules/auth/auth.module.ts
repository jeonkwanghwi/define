/**
 * AuthModule — auth 한 덩어리. WordModule과 같은 DI 바인딩 패턴.
 *   - JwtModule.registerAsync: ConfigService에서 secret/만료를 읽어 토큰 서명 설정
 *   - PassportModule: passport 통합
 *   - providers: UserRepository(계약) → PrismaUserRepository(구현) 바인딩
 *   - JwtStrategy를 provider로 등록 → 앱 전역에서 'jwt' 전략 사용 가능(다른 모듈 가드도)
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaUserRepository } from './user.repository.prisma';
import { UserRepository } from './user.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        // expiresIn 타입이 number|StringValue라 string 그대로는 안 들어감 → 명시 캐스팅
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') as `${number}${'d' | 'h' | 'm' | 's'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: UserRepository, useClass: PrismaUserRepository },
  ],
})
export class AuthModule {}
