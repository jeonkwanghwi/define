/**
 * 카카오 로그인 — 인가 화면을 띄우고 **인가 코드**를 받아오는 곳까지가 이 파일의 책임.
 * 코드를 계정으로 바꾸는 일은 서버(`POST /api/auth/kakao`)가 한다.
 *
 * ─── 왜 이렇게 복잡한가 (주소가 두 개다) ───────────────────────────
 * 카카오는 **리다이렉트 주소로 http/https만** 받는다. 앱 스킴(define://)을 등록하면
 * "유효하지 않은 URL"로 거부한다. 그래서 두 주소가 서로 다른 역할을 한다.
 *
 *   redirectUri — 카카오에게 주는 주소. 우리 **서버의 콜백**이다.
 *                 콘솔에 등록된 문자열과 한 글자도 달라선 안 된다(다르면 KOE006).
 *                 서버는 받은 쿼리를 그대로 앱 스킴으로 302 돌려보내기만 한다.
 *   returnUrl   — 브라우저 세션이 "이제 앱으로 돌아가라"고 판단하는 주소.
 *                 iOS 인증 세션은 **커스텀 스킴만 가로챌 수 있다** — 여기에 서버
 *                 주소를 주면 영원히 안 돌아온다.
 *
 * 그래서 `promptAsync()`를 쓰지 않는다. 그건 redirectUri를 곧 returnUrl로 쓰는데,
 * 우리의 redirectUri는 https(서버)라 앱으로 복귀하지 못한다. 인가 URL만 만들어
 * `WebBrowser.openAuthSessionAsync(url, 'define://oauth')`로 직접 연다.
 *
 * PKCE: expo-auth-session이 기본으로 켠다(S256). code_verifier는 이 기기에만 있고
 * 서버로 함께 보내 교환에 쓴다 — 코드가 새어도 남이 토큰으로 바꿀 수 없다.
 */
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { useCallback, useMemo } from 'react';
import * as WebBrowser from 'expo-web-browser';

import { API_BASE } from '@/services/api-client';

// 리다이렉트로 브라우저가 열렸다 앱으로 돌아올 때 대기 중인 프라미스를 정리한다.
// 안 하면 두 번째 로그인 시도부터 응답이 오지 않는다.
WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

/** 서버 콜백이 302로 돌려보내는 주소. app.json의 scheme(define)과 맞아야 한다. */
const RETURN_URL = 'define://oauth';

/** 사용자가 동의 화면에서 취소한 경우 — 에러가 아니라 정상적인 선택이다. */
export class KakaoCanceled extends Error {
  constructor() {
    super('카카오 로그인을 취소했어요.');
    this.name = 'KakaoCanceled';
  }
}

export type KakaoCodeResult = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

/**
 * 인가 코드를 받아오는 훅.
 *
 * `configured`가 false면 키가 주입되지 않은 빌드다(화면이 버튼을 잠근다).
 * 성공하면 서버에 넘길 세 값을 돌려주고, 취소면 KakaoCanceled를 던진다.
 */
export function useKakaoAuth() {
  const clientId = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';
  // 서버 콜백. API_BASE가 '…/api'로 끝나므로 그대로 이어 붙인다.
  const redirectUri = useMemo(() => `${API_BASE}/auth/kakao/callback`, []);

  const [request] = AuthSession.useAuthRequest(
    {
      clientId,
      // openid 하나만 요청한다 — id_token을 받기 위한 최소값이고,
      // 프로필·이메일은 동의항목을 안 켰으므로 애초에 못 받는다(그게 의도다).
      scopes: ['openid'],
      redirectUri,
    },
    DISCOVERY,
  );

  const getAuthCode = useCallback(async (): Promise<KakaoCodeResult> => {
    if (!request) throw new Error('카카오 로그인 준비 중이에요. 잠시 후 다시 시도해 주세요.');

    const authUrl = await request.makeAuthUrlAsync(DISCOVERY);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);
    if (result.type !== 'success') throw new KakaoCanceled();

    const { queryParams } = Linking.parse(result.url);
    const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
    if (error) {
      // 카카오가 붙여 보낸 실패 사유. 사용자가 동의를 거부한 경우가 대부분이다.
      if (error === 'access_denied') throw new KakaoCanceled();
      throw new Error('카카오 로그인에 실패했어요.');
    }

    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    const state = typeof queryParams?.state === 'string' ? queryParams.state : null;
    if (!code) throw new Error('카카오 로그인에 실패했어요.');
    // state 대조 — 우리가 시작하지 않은 응답(다른 앱이 스킴을 가로채 끼워 넣은 코드)을 막는다.
    if (state !== request.state) throw new Error('카카오 로그인에 실패했어요.');
    if (!request.codeVerifier) throw new Error('카카오 로그인에 실패했어요.');

    return { code, codeVerifier: request.codeVerifier, redirectUri };
  }, [request, redirectUri]);

  return { configured: clientId.length > 0, getAuthCode };
}
