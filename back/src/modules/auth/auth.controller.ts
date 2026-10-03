/**
 * AuthController — /api/auth/* 매핑. 로직 없음, service 호출만.
 * signup/login/kakao/apple은 공개, profile은 JwtAuthGuard로 보호.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AppleLoginDto } from './dto/apple-login.dto';
import { AuthResponse } from './dto/auth.response';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** POST /api/auth/signup — 이메일+비밀번호 가입(프로필은 별도 PATCH). */
  @Post('signup')
  @HttpCode(201)
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.auth.signup(dto);
  }

  /** POST /api/auth/login — 로그인. */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  /**
   * GET /api/auth/kakao/callback — 카카오가 인가 코드를 돌려보내는 자리.
   *
   * 여기서는 아무것도 해석하지 않고 받은 쿼리를 그대로 앱 스킴으로 돌려보낸다.
   * 왜 이 엔드포인트가 필요한가: **카카오는 리다이렉트 주소로 http/https만 받는다.**
   * 앱 스킴(define://)을 등록하면 유효하지 않은 URL로 거부하므로, 앱이 카카오에서
   * 곧장 돌아올 수 없고 서버를 한 번 거쳐야 한다.
   *
   * 실패(error=...)도 그대로 실어 보내야 앱이 사용자에게 사유를 보여줄 수 있다.
   * 코드 교환은 아래 POST에서 한다 — code_verifier는 앱에만 있기 때문이다.
   */
  @Get('kakao/callback')
  @Redirect()
  kakaoCallback(@Query() query: Record<string, string>): { url: string; statusCode: number } {
    const scheme = this.config.get<string>('app.scheme') ?? 'define';
    const qs = new URLSearchParams(query).toString();
    const target = `${scheme}://oauth`;
    return { url: qs ? `${target}?${qs}` : target, statusCode: 302 };
  }

  /**
   * POST /api/auth/kakao — 인가 코드를 우리 토큰으로 바꾼다.
   * 기존 회원이면 로그인, 처음이면 그 자리에서 가입까지 끝낸다(응답 형태는 동일).
   */
  @Post('kakao')
  @HttpCode(200)
  kakaoLogin(@Body() dto: KakaoLoginDto): Promise<AuthResponse> {
    return this.auth.kakaoLogin(dto);
  }

  /**
   * POST /api/auth/apple — Apple identityToken을 우리 토큰으로 교환.
   * 카카오와 달리 콜백 엔드포인트가 없다(네이티브 시트가 토큰을 바로 준다).
   */
  @Post('apple')
  @HttpCode(200)
  appleLogin(@Body() dto: AppleLoginDto): Promise<AuthResponse> {
    return this.auth.appleLogin(dto);
  }

  /**
   * DELETE /api/auth/me — 회원 탈퇴(토큰 필수).
   *
   * 앱스토어 심사 요건이다(계정을 만들 수 있으면 지울 수도 있어야 한다).
   * 소셜 연결은 제공자 쪽에서도 끊고, 끊지 못한 제공자는 응답에 담아 앱이 안내할 수 있게 한다.
   */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  deleteAccount(
    @Req() req: { user: { userId: string } },
  ): Promise<{ unlinked: string[]; failed: string[] }> {
    return this.auth.deleteAccount(req.user.userId);
  }

  /** PATCH /api/auth/profile — 프로필 완성/수정(토큰 필수). */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  updateProfile(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthResponse> {
    return this.auth.updateProfile(req.user.userId, dto);
  }

  /** PATCH /api/auth/nickname — 닉네임 설정/변경(토큰 필수). 빈 문자열 = 미설정으로 되돌리기. */
  @Patch('nickname')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  updateNickname(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateNicknameDto,
  ): Promise<AuthResponse> {
    return this.auth.updateNickname(req.user.userId, dto);
  }
}
