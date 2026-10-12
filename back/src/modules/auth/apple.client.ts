/**
 * AppleClient — Apple이 서명한 identityToken을 검증하고 계정 식별자(sub)만 꺼낸다.
 *
 * 카카오보다 단순하다. 카카오는 브라우저를 거쳐 인가 코드를 받아 서버가 토큰으로 바꿨지만,
 * Apple은 **네이티브 시트가 identityToken(JWT)을 바로 준다.** 인가 코드도, 리다이렉트 URI도,
 * 클라이언트 시크릿도 없다. 그래서 여기서는 JWKS로 서명만 확인하면 끝난다.
 *
 * audience = 우리 앱의 번들 ID. 다른 앱용으로 발급된 토큰을 가져와도 여기서 걸린다.
 *
 * 개인정보: 이름·이메일은 요청하지 않는다(카카오와 동일한 원칙). Apple은 그것들을
 * **첫 로그인 때만** 주고 "이메일 가리기"면 릴레이 주소를 주므로, 어차피 계정의
 * 신뢰할 수 있는 식별자가 못 된다. 우리에게 필요한 건 sub 하나뿐이다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';

const JWKS_URL = new URL('https://appleid.apple.com/auth/keys');
const ISSUER = 'https://appleid.apple.com';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/** 토큰이 위조됐거나 우리 앱 것이 아닌 경우. 컨트롤러가 401로 바꾼다. */
export class AppleAuthError extends Error {}

@Injectable()
export class AppleClient {
  private readonly logger = new Logger(AppleClient.name);
  /** 공개키는 캐시된다(로그인마다 받지 않는다). 키 교체 시 자동 갱신. */
  private readonly jwks = createRemoteJWKSet(JWKS_URL);

  constructor(private readonly config: ConfigService) {}

  /** 번들 ID가 설정돼 있는가. 없으면 엔드포인트가 503(설정 누락을 조용히 넘기지 않는다). */
  get configured(): boolean {
    return this.bundleId.length > 0;
  }

  private get bundleId(): string {
    return this.config.get<string>('apple.bundleId') ?? '';
  }

  /** identityToken 검증 후 sub(Apple 계정 식별자) 반환. 실패는 전부 AppleAuthError. */
  async verifyIdentityToken(identityToken: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(identityToken, this.jwks, {
        issuer: ISSUER,
        audience: this.bundleId,
      });
      const sub = payload.sub;
      if (!sub) throw new Error('sub 없음');
      return sub;
    } catch (e) {
      this.logger.warn(`Apple identityToken 검증 실패: ${String(e)}`);
      throw new AppleAuthError('Apple 로그인에 실패했습니다.');
    }
  }

  /** 연결 해제에 필요한 설정(팀·키·비밀키)이 다 있는가. */
  private get canRevoke(): boolean {
    const { teamId, keyId, privateKey } = this.config.get<{
      teamId: string;
      keyId: string;
      privateKey: string;
    }>('apple') ?? { teamId: '', keyId: '', privateKey: '' };
    return Boolean(teamId && keyId && privateKey);
  }

  /**
   * client_secret — Apple은 고정 문자열이 아니라 **우리가 서명해 만든 JWT**를 요구한다.
   * 비밀키(.p8)는 서버에만 있으므로, 이 JWT를 만들 수 있다는 것 자체가 신원 증명이 된다.
   * 수명은 짧게 둔다(쓰고 버린다 — 길게 둘 이유가 없다).
   */
  private async clientSecret(): Promise<string> {
    const teamId = this.config.get<string>('apple.teamId') ?? '';
    const keyId = this.config.get<string>('apple.keyId') ?? '';
    const privateKey = this.config.get<string>('apple.privateKey') ?? '';
    const key = await importPKCS8(privateKey, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setAudience(ISSUER)
      .setSubject(this.bundleId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  }

  /**
   * 인가 코드 → refresh token.
   *
   * 로그인 자체에는 필요 없다(identityToken만으로 누군지 안다). 오직 **나중에 탈퇴할 때
   * 연결을 끊기 위해** 받아둔다 — 폐기에는 토큰이 있어야 하는데, 토큰은 로그인 순간의
   * 인가 코드로만 얻을 수 있고 그 코드는 몇 분 만에 죽는다.
   *
   * 실패해도 null만 돌려준다. 이것 때문에 로그인을 막으면, 폐기라는 **나중 일** 때문에
   * 지금 들어오려는 사람을 못 들어오게 하는 셈이다.
   */
  async exchangeCode(authorizationCode: string): Promise<string | null> {
    if (!this.canRevoke) {
      this.logger.warn('Apple 연결 해제 설정이 없어 인가 코드 교환을 건너뛴다.');
      return null;
    }
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.bundleId,
          client_secret: await this.clientSecret(),
          grant_type: 'authorization_code',
          code: authorizationCode,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Apple 인가 코드 교환 실패(${res.status}): ${await res.text()}`);
        return null;
      }
      const body = (await res.json()) as { refresh_token?: string };
      return body.refresh_token ?? null;
    } catch (e) {
      this.logger.warn(`Apple 인가 코드 교환 중 오류: ${String(e)}`);
      return null;
    }
  }

  /**
   * 연결 해제 — 탈퇴 시 호출한다. 성공하면 true.
   * (카카오 unlink와 같은 계약: 실패해도 탈퇴는 진행되고, 결과만 응답에 담긴다.)
   *
   * 주의: Apple은 **이미 폐기됐거나 엉뚱한 토큰에도 200을 준다**(멱등 설계라 그렇다).
   * 그래서 true는 "Apple이 요청을 받아들였다"는 뜻이지 "방금 끊었다"의 증거는 아니다.
   * 실측(2026-10-12): 가짜 토큰으로 호출해도 200·본문 없음. 키가 틀렸을 때만 invalid_client가 온다.
   */
  async revoke(refreshToken: string): Promise<boolean> {
    if (!this.canRevoke) {
      this.logger.warn('Apple 연결 해제 설정이 없어 폐기를 건너뛴다.');
      return false;
    }
    try {
      const res = await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.bundleId,
          client_secret: await this.clientSecret(),
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
      if (!res.ok) this.logger.warn(`Apple 연결 해제 실패(${res.status}): ${await res.text()}`);
      return res.ok;
    } catch (e) {
      this.logger.warn(`Apple 연결 해제 중 오류: ${String(e)}`);
      return false;
    }
  }
}
