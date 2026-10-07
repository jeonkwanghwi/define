/**
 * AuthModule — auth 한 덩어리. WordModule과 같은 DI 바인딩 패턴.
 *   - JwtModule.registerAsync: ConfigService에서 secret/만료를 읽어 토큰 서명 설정
 *   - PassportModule: passport 통합
 *   - providers: UserRepository(계약) → PrismaUserRepository(구현) 바인딩
 *   - MailService는 useFactory로 바인딩: MAIL_FROM 유무에 따라 SES/콘솔이 갈린다
 *   - JwtStrategy를 provider로 등록 → 앱 전역에서 'jwt' 전략 사용 가능(다른 모듈 가드도)
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppleClient } from './apple.client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailCodeService } from './email-code.service';
import { PrismaEmailCodeRepository } from './email-code.repository.prisma';
import { EmailCodeRepository } from './email-code.repository';
import { JwtStrategy } from './jwt.strategy';
import { KakaoClient } from './kakao.client';
import { ConsoleMailService } from './mail.console';
import { MailService } from './mail.service';
import { SesMailService } from './mail.ses';
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
    KakaoClient,
    AppleClient,
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: EmailCodeRepository, useClass: PrismaEmailCodeRepository },
    /**
     * 메일 발송 구현을 설정으로 고른다. MAIL_FROM이 비어 있으면 콘솔(코드를 서버 로그에 찍는다),
     * 있으면 SES. 콘솔 구현이 운영까지 따라 들어가지 못하게 **배선에서** 갈라놓는 게 핵심이다.
     */
    {
      provide: MailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('mail.from') ? new SesMailService(config) : new ConsoleMailService(),
    },
    EmailCodeService,
  ],
  // MailService만 내보낸다 — FeedbackModule이 제보 메일을 보내려고 쓴다.
  // 발송 수단은 여기 useFactory 하나뿐이어야 한다(두 군데서 배선하면 configuration set을 한쪽만 빼먹는다).
  exports: [MailService],
})
export class AuthModule {}
