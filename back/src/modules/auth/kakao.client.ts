/**
 * KakaoClient — 카카오에서 "이 사람이 누구인지"만 받아오는 얇은 클라이언트.
 *
 * 하는 일은 두 가지뿐이다.
 *   1) 인가 코드 → 토큰 교환 (client_secret이 필요해 반드시 서버에서)
 *   2) 받은 id_token의 서명을 검증하고 회원번호(sub)만 꺼내기
 *
 * 왜 서버가 교환하는가:
 *   우리 앱의 REST API 키는 **클라이언트 시크릿이 켜져 있다**(카카오가 신규 키에 기본
 *   활성화한다). 시크릿을 앱 번들에 넣으면 누구나 꺼낼 수 있으므로, 교환은 서버 몫이다.
 *   앱은 PKCE의 code_verifier만 들고 있다가 코드와 함께 보낸다 — 코드가 새어도
 *   verifier가 없으면 토큰으로 바꿀 수 없다(커스텀 스킴 가로채기 방어).
 *
 * 왜 액세스 토큰으로 사용자 정보를 다시 묻지 않는가:
 *   id_token은 카카오가 서명한 문서다. JWKS로 공개키를 받아 서명·발급자·audience를
 *   검증하면 네트워크 왕복 없이 "카카오가 발급한 진짜"임을 확인할 수 있다.
 *   그리고 우리에게 필요한 건 sub 하나뿐이다.
 *
 * 개인정보: 동의항목을 하나도 켜지 않으면 id_token 페이로드에는
 * iss/aud/sub/iat/exp/auth_time만 들어온다(닉네임·이메일·프로필사진은 동의 필요).
 * 즉 카카오에서 받는 것은 **식별자 하나**뿐이다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const UNLINK_ENDPOINT = 'https://kapi.kakao.com/v1/user/unlink';
const JWKS_URL = new URL('https://kauth.kakao.com/.well-known/jwks.json');
const ISSUER = 'https://kauth.kakao.com';

/** 카카오가 코드 교환에 실패했거나 토큰이 위조된 경우. 컨트롤러가 401로 바꾼다. */
export class KakaoAuthError extends Error {}

@Injectable()
export class KakaoClient {
  private readonly logger = new Logger(KakaoClient.name);
  /** JWKS는 캐시된다(공개키를 매 로그인마다 받지 않는다). 키 교체 시 자동 갱신. */
  private readonly jwks = createRemoteJWKSet(JWKS_URL);

  constructor(private readonly config: ConfigService) {}

  /** 콘솔에 키가 설정돼 있는가. 없으면 엔드포인트가 503을 준다(설정 누락을 조용히 넘기지 않는다). */
  get configured(): boolean {
    return this.restApiKey.length > 0 && this.clientSecret.length > 0;
  }

  private get restApiKey(): string {
    return this.config.get<string>('kakao.restApiKey') ?? '';
  }

  private get clientSecret(): string {
    return this.config.get<string>('kakao.clientSecret') ?? '';
  }

  private get adminKey(): string {
    return this.config.get<string>('kakao.adminKey') ?? '';
  }

  /**
   * 회원 탈퇴 시 카카오 쪽 연결도 끊는다(우리 DB만 지우면 카카오에는 연결이 남는다).
   *
   * 사용자 액세스 토큰을 저장하지 않으므로 **어드민 키**로 회원번호를 지목하는 경로뿐이다.
   * 실패해도 탈퇴 자체는 진행한다 — 사용자 데이터 삭제가 더 중요하고,
   * 연결은 사용자가 카카오 설정에서 직접 끊을 수도 있다. 대신 반드시 로그로 남긴다.
   *
   * @returns 끊었으면 true, 키 미설정·실패면 false
   */
  async unlink(providerSub: string): Promise<boolean> {
    if (!this.adminKey) {
      this.logger.warn('KAKAO_ADMIN_KEY가 없어 연결 해제를 건너뜁니다.');
      return false;
    }
    try {
      const res = await fetch(UNLINK_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `KakaoAK ${this.adminKey}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body: new URLSearchParams({ target_id_type: 'user_id', target_id: providerSub }),
      });
      if (!res.ok) {
        this.logger.warn(`카카오 연결 해제 실패(${res.status}): ${await res.text()}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`카카오 연결 해제 요청 실패: ${String(e)}`);
      return false;
    }
  }

  /**
   * 인가 코드를 회원번호로 바꾼다. 실패는 전부 KakaoAuthError.
   *
   * redirectUri는 **인가 요청 때 보낸 값과 한 글자도 같아야 한다**(다르면 카카오가 거부한다).
   * 그래서 앱이 쓴 값을 그대로 받아서 넘긴다.
   */
  async exchangeCodeForSub(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<string> {
    const idToken = await this.requestIdToken(input);
    return this.verifyIdToken(idToken);
  }

  private async requestIdToken(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.restApiKey,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
      code_verifier: input.codeVerifier,
    });

    let res: Response;
    try {
      res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body,
      });
    } catch (e) {
      // 네트워크 실패 — 카카오 잘못도 사용자 잘못도 아니다. 원인은 로그에만.
      this.logger.error(`카카오 토큰 요청 실패: ${String(e)}`);
      throw new KakaoAuthError('카카오와 통신하지 못했습니다.');
    }

    if (!res.ok) {
      // 카카오 에러 본문은 로그에만 남긴다(사용자에게 그대로 보여줄 내용이 아니다).
      this.logger.warn(`카카오 토큰 교환 거부(${res.status}): ${await res.text()}`);
      throw new KakaoAuthError('카카오 로그인에 실패했습니다.');
    }

    const json = (await res.json()) as { id_token?: string };
    if (!json.id_token) {
      // 콘솔에서 OpenID Connect가 꺼져 있으면 여기로 온다 — 증상이 조용해서 꼭 구분해 남긴다.
      this.logger.error('id_token이 없습니다. 카카오 콘솔의 OpenID Connect 활성화를 확인하세요.');
      throw new KakaoAuthError('카카오 로그인에 실패했습니다.');
    }
    return json.id_token;
  }

  /** 서명·발급자·audience 검증 후 sub(회원번호) 반환. audience는 우리 REST API 키다. */
  private async verifyIdToken(idToken: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ISSUER,
        audience: this.restApiKey,
      });
      const sub = payload.sub;
      if (!sub) throw new Error('sub 없음');
      return sub;
    } catch (e) {
      this.logger.warn(`id_token 검증 실패: ${String(e)}`);
      throw new KakaoAuthError('카카오 로그인에 실패했습니다.');
    }
  }
}
