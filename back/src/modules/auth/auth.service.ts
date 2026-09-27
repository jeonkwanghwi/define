/**
 * AuthService — 인증 로직. controller(HTTP)와 repository(DB) 사이.
 *   - signup: 이메일 중복 검사 → bcrypt 해싱 → 디폴트 닉네임 배정 → 생성 → 토큰 발급
 *   - login:  이메일 조회 → bcrypt 비교 → 토큰 발급
 *   - kakaoLogin: 인가 코드 → (카카오) 회원번호 → 기존 연결 조회 or 신규 생성 → 토큰 발급
 * 토큰 payload: { sub: userId, email }. (sub = JWT 표준 "subject" 클레임)
 *
 * 소셜 사용자는 email·passwordHash가 없다. 그래서 이메일 로그인 경로는
 * "비밀번호가 없는 계정"을 반드시 걸러야 한다(안 하면 bcrypt.compare가 터진다).
 */
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthResponse } from './dto/auth.response';
import { KakaoAuthError, KakaoClient } from './kakao.client';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserEntity } from './entities/user.entity';
import { generateNickname } from './nickname-generator';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
    private readonly kakao: KakaoClient,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const nickname = await this.pickDefaultNickname();
    const user = await this.users.create({ email: dto.email, passwordHash, nickname });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    // 이메일 없음/비번 틀림 모두 같은 메시지(계정 존재 여부 노출 방지)
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    // 소셜로만 가입한 계정은 비밀번호가 없다 — 존재 여부를 흘리지 않게 같은 메시지로 끊는다.
    if (!user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    return this.buildAuthResponse(user);
  }

  /**
   * 카카오 로그인 — 회원번호로 기존 회원을 찾고, 없으면 그 자리에서 가입시킨다.
   *
   * 이메일을 받지 않으므로 기존 이메일 계정과 자동 병합하지 않는다(병합할 근거가 없다).
   * 같은 사람이 이메일로도 가입했다면 계정이 둘로 남는다 — 알면서 택한 대가다.
   */
  async kakaoLogin(dto: KakaoLoginDto): Promise<AuthResponse> {
    if (!this.kakao.configured) {
      throw new ServiceUnavailableException('카카오 로그인이 아직 준비되지 않았어요.');
    }
    let sub: string;
    try {
      sub = await this.kakao.exchangeCodeForSub({
        code: dto.code,
        redirectUri: dto.redirectUri,
        codeVerifier: dto.codeVerifier,
      });
    } catch (e) {
      if (e instanceof KakaoAuthError) throw new UnauthorizedException(e.message);
      throw e;
    }

    const existing = await this.users.findBySocial('kakao', sub);
    if (existing) return this.buildAuthResponse(existing);

    const nickname = await this.pickDefaultNickname();
    const user = await this.users.createSocial({
      provider: 'kakao',
      providerSub: sub,
      nickname,
    });
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

  /** 가입용 디폴트 닉네임 — 랜덤 생성 후 중복이면 재시도, 계속 충돌하면 숫자 접미사. */
  private async pickDefaultNickname(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = generateNickname();
      if (!(await this.users.findByNickname(candidate))) return candidate;
    }
    const base = generateNickname();
    for (let n = 2; n <= 99; n++) {
      const candidate = `${base}${n}`;
      if (!(await this.users.findByNickname(candidate))) return candidate;
    }
    return base; // 사실상 도달 불가(500 조합×99) — unique 제약이 최종 방어선
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
