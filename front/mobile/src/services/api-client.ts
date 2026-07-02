/**
 * api-client — 백엔드(NestJS) 호출 공용 fetch 래퍼.
 * JSON 직렬화 + (토큰 있으면) Bearer 주입 + 응답 에러를 {status, message}로 정규화.
 * 각 도메인 함수(auth-api/journal-api)는 이걸 통해서만 서버와 통신한다.
 */

/**
 * API 주소. 배포/실기기에선 빌드 시 환경변수 `EXPO_PUBLIC_API_URL`로 주입.
 *   예) EXPO_PUBLIC_API_URL='https://define-api.up.railway.app/api'
 * 미설정(로컬 개발 웹/시뮬레이터)이면 localhost 폴백.
 * ★ 실기기(Expo Go)를 로컬 백엔드에 붙일 땐 개발 머신 LAN IP로:
 *   예) EXPO_PUBLIC_API_URL='http://192.168.0.10:3000/api'
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

/** 서버 에러를 화면이 다루기 쉬운 형태로. */
export type ApiError = { status: number; message: string };

type RequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

/**
 * 한 번의 API 호출. 성공이면 파싱된 T, 실패면 ApiError를 throw.
 * (NestJS 검증 에러는 message가 배열일 수 있어 첫 항목을 쓴다.)
 */
export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = '요청을 처리하지 못했어요.';
    try {
      const data = await res.json();
      if (data?.message) {
        message = Array.isArray(data.message) ? data.message[0] : data.message;
      }
    } catch {
      // body가 JSON이 아니면 기본 메시지 유지
    }
    const err: ApiError = { status: res.status, message };
    throw err;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
