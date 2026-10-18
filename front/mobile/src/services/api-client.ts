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

/**
 * 서버가 준 메시지를 사용자에게 보여줘도 되는가.
 *
 * 우리 서버는 사용자용 문구를 **한국어로** 쓴다. 반면 NestJS 기본 예외는 영어다
 * ("Unauthorized", "Forbidden", "Internal server error"). 그걸 그대로 화면에 뿌리면
 * 사용자는 영어 한 단어를 보고 무슨 일인지 알 수 없다 — 실제로 닉네임 저장 실패 때
 * "Unauthorized"가 그대로 떴다.
 *
 * 그래서 **한글이 없는 메시지는 우리 것이 아니라고 보고 버린다.** 화면마다 if를
 * 늘리는 대신 여기 한 곳에서 거른다.
 */
export function userFacingMessage(e: unknown): string | null {
  const msg = (e as Partial<ApiError> | undefined)?.message;
  if (!msg) return null;
  return /[가-힣]/.test(msg) ? msg : null;
}

type RequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  /** 응답을 기다리는 최대 시간(ms). 기본 15초 — AI 답장처럼 원래 오래 걸리는 호출만 늘린다. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 토큰이 거절됐을 때(401) 부를 함수. auth-store가 시작할 때 등록한다.
 * 왜 직접 import하지 않나: auth-store가 이미 이 파일(…-api)을 import하고 있어서,
 * 여기서 auth-store를 import하면 서로가 서로를 부르는 순환이 된다. 그래서 "등록" 방식.
 */
let onUnauthorized: ((token: string) => void) | null = null;
export function setUnauthorizedHandler(fn: (token: string) => void): void {
  onUnauthorized = fn;
}

/**
 * 한 번의 API 호출. 성공이면 파싱된 T, 실패면 ApiError를 throw.
 * (NestJS 검증 에러는 message가 배열일 수 있어 첫 항목을 쓴다.)
 */
export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  // 서버가 응답을 안 주면 fetch는 끝없이 기다린다 → "진행 중"이 영원히 돈다. 시간을 정해 끊는다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // 시간 초과(abort) 또는 네트워크 끊김. 영어 시스템 문구 대신 사용자가 할 수 있는 말로. status 0 = 응답 없음.
    const err: ApiError = controller.signal.aborted
      ? { status: 0, message: '서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.' }
      : { status: 0, message: '인터넷 연결을 확인하고 다시 시도해 주세요.' };
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // 토큰을 실어 보냈는데 401 = 그 토큰이 더는 유효하지 않다(만료·다른 곳에서 탈퇴·비밀번호 재설정).
    // 로그인/가입처럼 "비밀번호가 틀려서" 401이 나는 호출은 애초에 토큰을 싣지 않으므로 여기 안 걸린다.
    if (res.status === 401 && options.token) onUnauthorized?.(options.token);
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
