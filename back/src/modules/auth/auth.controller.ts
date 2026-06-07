/**
 * AuthController — /api/auth/* 매핑. 로직 없음, service 호출만.
 * @HttpCode로 상태코드 명시(기본 POST는 201이라 login만 200으로).
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth.response';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/signup — 이메일+비밀번호 가입. */
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
}
