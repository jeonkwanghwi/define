/**
 * Apple 로그인 — 네이티브 시트를 띄워 **identityToken**을 받아오는 곳까지가 이 파일의 책임.
 * 토큰을 계정으로 바꾸는 일은 서버(`POST /api/auth/apple`)가 한다.
 *
 * 카카오보다 단순하다: 브라우저도, 리다이렉트 URI도, PKCE도 없다. Apple이 서명한 JWT를
 * 시트가 바로 돌려주고, 서버는 Apple JWKS로 서명만 확인하면 된다.
 *
 * **iOS 전용이다.** Android·웹에는 없고, 시뮬레이터에서도 불안정해 실기기 검증이 필요하다.
 * 그래서 화면은 `isAvailableAsync()` 결과를 보고 버튼을 잠근다 — 눌러도 아무 일이 없으면
 * 고장으로 보인다.
 *
 * 인가 코드는 **탈퇴 때 Apple 연결을 끊기 위해** 함께 받는다(심사 가이드 5.1.1(v)).
 * 서버가 이것을 Apple 토큰으로 교환해 보관한다 — 로그인 자체에는 쓰이지 않는다.
 *
 * 이름·이메일은 요청하지 않는다. Apple은 그것들을 **첫 로그인 때만** 주고, "이메일 가리기"를
 * 고르면 릴레이 주소를 준다. 계정의 신뢰할 수 있는 식별자가 못 되므로 sub만 쓴다
 * (카카오에서 회원번호만 받는 것과 같은 원칙).
 */
import * as AppleAuthentication from 'expo-apple-authentication';

/** 사용자가 시트에서 취소한 경우 — 에러가 아니라 정상적인 선택이다. */
export class AppleCanceled extends Error {
  constructor() {
    super('Apple 로그인을 취소했어요.');
    this.name = 'AppleCanceled';
  }
}

/** 이 기기에서 Apple 로그인을 쓸 수 있는가(iOS 13+). */
export function isAppleAuthAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/** 시트가 돌려주는 것 — 로그인에 쓰는 토큰과, 탈퇴 때 쓸 인가 코드. */
export type AppleCredential = {
  identityToken: string;
  /** 서버가 Apple 토큰으로 교환해 보관한다 — 탈퇴 시 연결 해제에만 쓴다. 없을 수 있다. */
  authorizationCode?: string;
};

/**
 * Apple 시트를 띄워 자격증명을 받는다.
 * 취소면 AppleCanceled, 토큰이 안 오면 일반 Error.
 */
export async function getAppleCredential(): Promise<AppleCredential> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    // scope를 비워 이름·이메일을 아예 요청하지 않는다(동의 화면도 그만큼 가벼워진다).
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new AppleCanceled();
    throw e;
  }
  if (!credential.identityToken) {
    // 토큰이 없으면 서버가 검증할 것이 없다. 빈 값을 보내 401을 받는 것보다 여기서 끊는 편이
    // 원인(취소인지 토큰 문제인지)을 구분하기 쉽다.
    throw new Error('Apple이 인증 토큰을 주지 않았어요.');
  }
  // 인가 코드가 없어도 로그인은 된다 — 막지 않는다. 그 계정은 탈퇴 때 연결만 못 끊는다.
  return {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode ?? undefined,
  };
}
