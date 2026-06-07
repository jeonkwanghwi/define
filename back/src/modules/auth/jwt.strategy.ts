/**
 * JwtStrategy — passport-jwt 전략. Authorization: Bearer <token>을 읽어
 * 서명·만료 검증 후 validate()의 반환값을 req.user로 만든다.
 * 보호 라우트(@UseGuards(JwtAuthGuard))에서 이 결과를 꺼내 쓴다.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') as string,
    });
  }

  /** payload(우리가 sign할 때 넣은 { sub, email })를 req.user 형태로 변환. */
  async validate(payload: { sub: string; email: string }): Promise<{
    userId: string;
    email: string;
  }> {
    return { userId: payload.sub, email: payload.email };
  }
}
