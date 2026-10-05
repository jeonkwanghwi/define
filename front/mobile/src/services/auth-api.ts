/**
 * auth-api — 회원가입/로그인 호출. 백엔드 계약(POST /api/auth/*)에 1:1.
 * 응답에 passwordHash는 없음(서버가 token+공개 user만 반환).
 */
import { apiRequest } from './api-client';

export type AuthUser = {
  id: string;
  /** 소셜 로그인으로만 가입한 사용자는 이메일이 없다(카카오는 이메일을 주지 않는다). */
  email: string | null;
  nickname: string | null;
  birthYear: number | null;
  gender: 'male' | 'female' | null;
  interests: string[];
  profileCompleted: boolean;
  balance: number;
  recallConsented: boolean;
};

export type AuthResult = {
  token: string;
  user: AuthUser;
};

/**
 * POST /api/auth/email/code — 가입·비밀번호 재설정용 인증번호 발송.
 * 204(본문 없음)라 돌려줄 게 없다. 재설정은 계정이 없어도 204다 — 존재 여부를 숨기려는 설계.
 * 429 = 쿨다운/일일 상한, 409 = (가입) 이미 가입된 이메일.
 */
export function requestEmailCode(email: string, purpose: 'signup' | 'reset'): Promise<void> {
  return apiRequest<void>('/auth/email/code', { method: 'POST', body: { email, purpose } });
}

/** POST /api/auth/signup — 인증번호(code)가 맞아야 계정이 만들어진다. 400 = 번호 불일치/만료. */
export function signup(email: string, password: string, code: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/signup', {
    method: 'POST',
    body: { email, password, code },
  });
}

/** POST /api/auth/password/reset — 인증번호 확인 + 새 비밀번호. 성공하면 바로 로그인된다. */
export function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/password/reset', {
    method: 'POST',
    body: { email, code, password },
  });
}

/** POST /api/auth/login */
export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * POST /api/auth/kakao — 카카오 인가 코드를 우리 토큰으로 교환.
 *
 * 코드→토큰 교환은 **서버가** 한다(클라이언트 시크릿이 필요한데 앱에 두면 유출된다).
 * 앱은 PKCE의 code_verifier만 넘긴다 — 코드가 새도 이것 없이는 토큰이 안 나온다.
 * redirectUri는 인가 요청에 쓴 값과 한 글자도 같아야 한다(카카오가 대조한다).
 *
 * 401 = 코드 만료/위조, 503 = 서버에 카카오 키 미설정.
 */
export function kakaoLogin(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/kakao', { method: 'POST', body: input });
}

/**
 * POST /api/auth/apple — Apple identityToken을 우리 토큰으로 교환.
 * 서버가 Apple JWKS로 서명을 검증하고 sub만 꺼내 계정을 찾거나 만든다.
 * 401 = 토큰 위조/만료, 503 = 서버에 번들 ID 미설정.
 */
export function appleLogin(identityToken: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/apple', { method: 'POST', body: { identityToken } });
}

/**
 * DELETE /api/auth/me — 회원 탈퇴. 서버 데이터 삭제 + 소셜 연결 해제.
 * 끊지 못한 제공자는 failed로 돌아온다(사용자에게 직접 해제를 안내하기 위해).
 */
export function deleteAccount(token: string): Promise<{ unlinked: string[]; failed: string[] }> {
  return apiRequest<{ unlinked: string[]; failed: string[] }>('/auth/me', {
    method: 'DELETE',
    token,
  });
}

/** PATCH /api/auth/profile — 프로필 완성/수정. */
export function updateProfile(
  token: string,
  input: { birthYear: number; gender: 'male' | 'female'; interests: string[] },
): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/profile', {
    method: 'PATCH',
    token,
    body: input,
  });
}

/** PATCH /api/auth/nickname — 닉네임 설정/변경. 빈 문자열 = 미설정. 중복이면 409 ApiError. */
export function updateNickname(token: string, nickname: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/nickname', {
    method: 'PATCH',
    token,
    body: { nickname },
  });
}
