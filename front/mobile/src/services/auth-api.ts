/**
 * auth-api — 회원가입/로그인 호출. 백엔드 계약(POST /api/auth/*)에 1:1.
 * 응답에 passwordHash는 없음(서버가 token+공개 user만 반환).
 */
import { apiRequest } from './api-client';

export type AuthUser = {
  id: string;
  email: string;
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

/** POST /api/auth/signup */
export function signup(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/signup', {
    method: 'POST',
    body: { email, password },
  });
}

/** POST /api/auth/login */
export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
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
