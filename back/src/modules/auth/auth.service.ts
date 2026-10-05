/**
 * AuthService — 인증 로직. controller(HTTP)와 repository(DB) 사이.
 *   - requestEmailCode: 인증번호 발송(가입·비밀번호 재설정 공용)
 *   - signup: 이메일 중복 검사 → 인증번호 확인 → bcrypt 해싱 → 디폴트 닉네임 배정 → 생성 → 토큰 발급
 *   - login:  이메일 조회 → bcrypt 비교 → 토큰 발급
 *   - resetPassword: 인증번호 확인 → 새 비밀번호 저장 → 토큰 발급
 *   - kakaoLogin: 인가 코드 → (카카오) 회원번호 → 기존 연결 조회 or 신규 생성 → 토큰 발급
 *   - appleLogin: identityToken 검증 → (Apple) sub → 같은 흐름
 *   - deleteAccount: 제공자 연결 해제(best-effort) → 우리 데이터 삭제
 * 토큰 payload: { sub: userId, email }. (sub = JWT 표준 "subject" 클레임)
 *
 * 소셜 사용자는 email·passwordHash가 없다. 그래서 이메일 로그인 경로는
 * "비밀번호가 없는 계정"을 반드시 걸러야 한다(안 하면 bcrypt.compare가 터진다).
 */
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AppleAuthError, AppleClient } from './apple.client';
import { AppleLoginDto } from './dto/apple-login.dto';
import { AuthResponse } from './dto/auth.response';
import { EmailCodeService } from './email-code.service';
import { KakaoAuthError, KakaoClient } from './kakao.client';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { LoginDto } from './dto/login.dto';
import { RequestCodeDto } from './dto/request-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
    private readonly apple: AppleClient,
    private readonly codes: EmailCodeService,
  ) {}

  /** 인증번호 발송. 가입은 중복 이메일을 즉시 알리고, 재설정은 계정 존재를 숨긴다. */
  async requestEmailCode(dto: RequestCodeDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (dto.purpose === 'signup') {
      if (user) throw new ConflictException('이미 가입된 이메일입니다.');
    } else {
      // 계정이 없거나 소셜 전용(비밀번호 없음)이면 조용히 끝낸다 —
      // 404를 주면 "이 이메일이 가입돼 있다"를 누구나 확인할 수 있다.
      if (!user || !user.passwordHash) return;
    }
    await this.codes.issue(dto.email, dto.purpose);
  }

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    // 코드를 아예 안 보낸 요청 = 이미 배포된 구버전 앱(1.0.0(2))이다. 그 앱은 가입 화면에
    // 인증번호 단계가 없어서 {email, password}만 보낸다. 여기서 400으로 끊으면 사용자는
    // 영어 검증 메시지나 뭉뚱그린 400만 보고 왜 막혔는지 모른다 — 그래서 426으로,
    // 할 수 있는 일(업데이트)을 한국어로 알려준다.
    // 인증을 건너뛰게 해주는 분기가 아니다: 코드가 없으면 아래 verify에 가지도 않고 계정도 안 생긴다.
    // 구버전 앱이 전부 업데이트되면 이 분기와 SignupDto의 @IsOptional()을 같이 제거한다.
    if (!dto.code) {
      // @nestjs/common v10의 HttpStatus에는 426이 없어 숫자를 직접 쓴다(429도 같은 사정).
      throw new HttpException('앱을 최신 버전으로 업데이트해 주세요.', 426);
    }
    // 코드 확인이 통과해야 계정이 생긴다 — 그래서 미인증 계정이라는 상태가 존재하지 않는다.
    if (!(await this.codes.verify(dto.email, 'signup', dto.code))) {
      throw new BadRequestException('인증번호가 올바르지 않아요.');
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
   * 비밀번호 재설정 — 코드 확인 → 새 비밀번호 저장 → **바로 로그인시킨다**.
   * 재설정 직후 로그인 화면으로 다시 보내면 마찰만 늘고, 이메일 소유는 코드로 이미 증명됐다.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<AuthResponse> {
    if (!(await this.codes.verify(dto.email, 'reset', dto.code))) {
      throw new BadRequestException('인증번호가 올바르지 않아요.');
    }
    const user = await this.users.findByEmail(dto.email);
    // 코드까지 맞았는데 계정이 없다/비밀번호가 없다 = 그 사이 탈퇴했거나 소셜 전용 계정.
    // 사유를 따로 알려줄 이유가 없어 코드 불일치와 같은 응답으로 끊는다.
    if (!user || !user.passwordHash) {
      throw new BadRequestException('인증번호가 올바르지 않아요.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.users.updatePassword(user.id, passwordHash);
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

    return this.findOrCreateSocial('kakao', sub);
  }

  /**
   * Apple 로그인 — 카카오와 같은 자리(AuthIdentity)에 provider만 다르게 얹는다.
   * 이름·이메일은 받지 않는다. Apple은 첫 로그인 때만 주고 "이메일 가리기"면
   * 릴레이 주소라, 계정 식별자로 쓸 수 없다.
   */
  async appleLogin(dto: AppleLoginDto): Promise<AuthResponse> {
    if (!this.apple.configured) {
      throw new ServiceUnavailableException('Apple 로그인이 아직 준비되지 않았어요.');
    }
    let sub: string;
    try {
      sub = await this.apple.verifyIdentityToken(dto.identityToken);
    } catch (e) {
      if (e instanceof AppleAuthError) throw new UnauthorizedException(e.message);
      throw e;
    }
    return this.findOrCreateSocial('apple', sub);
  }

  /**
   * 회원 탈퇴 — 우리 데이터를 지우고, 소셜 연결도 제공자 쪽에서 끊는다.
   *
   * 순서가 중요하다: **연결 해제를 먼저** 시도한다. 사용자를 지운 뒤에는 어떤 제공자의
   * 어떤 계정이었는지 알 방법이 없어, 끊지 못한 연결이 영영 남는다.
   * 연결 해제 실패는 탈퇴를 막지 않는다 — 사용자 데이터 삭제가 더 중요하고,
   * 사용자가 제공자 설정에서 직접 끊을 수도 있다. 대신 결과를 응답에 담아 알린다.
   */
  async deleteAccount(userId: string): Promise<{ unlinked: string[]; failed: string[] }> {
    const identities = await this.users.findIdentities(userId);
    const unlinked: string[] = [];
    const failed: string[] = [];

    for (const { provider, providerSub } of identities) {
      // Apple은 연결 해제(revoke)에 Sign in with Apple 전용 키가 필요해 아직 미구현.
      const ok = provider === 'kakao' ? await this.kakao.unlink(providerSub) : false;
      (ok ? unlinked : failed).push(provider);
    }

    await this.users.deleteUser(userId);
    return { unlinked, failed };
  }

  /** 소셜 공통 — 이미 연결된 계정이면 로그인, 처음이면 그 자리에서 가입시킨다. */
  private async findOrCreateSocial(provider: string, sub: string): Promise<AuthResponse> {
    const existing = await this.users.findBySocial(provider, sub);
    if (existing) return this.buildAuthResponse(existing);

    const nickname = await this.pickDefaultNickname();
    const user = await this.users.createSocial({ provider, providerSub: sub, nickname });
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
