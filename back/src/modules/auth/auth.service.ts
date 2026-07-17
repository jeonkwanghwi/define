/**
 * AuthService — 인증 로직. controller(HTTP)와 repository(DB) 사이.
 *   - signup: 이메일 중복 검사 → bcrypt 해싱 → 생성 → 토큰 발급
 *   - login:  이메일 조회 → bcrypt 비교 → 토큰 발급
 * 토큰 payload: { sub: userId, email }. (sub = JWT 표준 "subject" 클레임)
 */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthResponse } from './dto/auth.response';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({ email: dto.email, passwordHash });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    // 이메일 없음/비번 틀림 모두 같은 메시지(계정 존재 여부 노출 방지)
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    return this.buildAuthResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthResponse> {
    const user = await this.users.updateProfile(userId, {
      birthYear: dto.birthYear,
      gender: dto.gender,
      interests: dto.interests,
    });
    return this.buildAuthResponse(user);
  }

  async updateNickname(userId: string, dto: UpdateNicknameDto): Promise<AuthResponse> {
    const nickname = dto.nickname.trim() || null; // 빈 값 = 미설정으로 되돌리기
    if (nickname) {
      const existing = await this.users.findByNickname(nickname);
      if (existing && existing.id !== userId) {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
    }
    const user = await this.users.updateNickname(userId, nickname);
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: UserEntity): AuthResponse {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    const profileCompleted =
      user.birthYear != null && user.gender != null && user.interests.length > 0;
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname ?? null,
        birthYear: user.birthYear,
        gender: user.gender,
        interests: user.interests,
        profileCompleted,
        balance: user.balance,
        recallConsented: user.recallConsentAt != null,
      },
    };
  }
}
