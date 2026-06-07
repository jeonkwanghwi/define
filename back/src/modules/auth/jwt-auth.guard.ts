/**
 * JwtAuthGuard — @UseGuards(JwtAuthGuard)로 라우트를 보호한다.
 * 토큰 없음/만료/위조면 자동 401. 통과 시 req.user 세팅(JwtStrategy.validate 결과).
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
