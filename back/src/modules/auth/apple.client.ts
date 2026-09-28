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
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL = new URL('https://appleid.apple.com/auth/keys');
const ISSUER = 'https://appleid.apple.com';

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
}
