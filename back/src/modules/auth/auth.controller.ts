/**
 * AuthController — /api/auth/* 매핑. 로직 없음, service 호출만.
 * signup/login은 공개, profile은 JwtAuthGuard로 보호.
 */
import { Body, Controller, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth.response';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
