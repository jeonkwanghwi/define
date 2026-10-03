/**
 * JwtStrategy — passport-jwt 전략. Authorization: Bearer <token>을 읽어
 * 서명·만료 검증 후 validate()의 반환값을 req.user로 만든다.
 * 보호 라우트(@UseGuards(JwtAuthGuard))에서 이 결과를 꺼내 쓴다.
 *
 * **서명이 맞는 것만으로는 부족하다.** 토큰은 90일짜리라, 탈퇴한 계정의 토큰이
 * 그 기간 내내 통과한다(실제로 탈퇴 후 GET /journal이 200을 주는 걸 확인했다).
 * 그래서 매 요청 계정 실존을 확인한다 — 보호 라우트당 조회 1회가 늘지만,
 * "지웠는데 아직 들어와진다"보다는 낫다. (차단·정지 기능이 생겨도 같은 자리를 쓴다.)
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserRepository } from './user.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UserRepository,
  ) {
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
    if (!(await this.users.existsById(payload.sub))) {
      throw new UnauthorizedException('계정을 찾을 수 없습니다.');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
