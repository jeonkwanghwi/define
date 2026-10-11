/**
 * AdMob SSV(Server-Side Verification) 콜백의 서명 검증.
 *
 * 왜 이 파일이 따로 있나: **이게 유일한 인증 수단이다.** /api/ads/ssv는 구글이 부르는
 * 공개 엔드포인트라 JWT가 없다. 서명이 뚫리면 누구나 URL을 때려서 잉크를 찍어낼 수 있다.
 * 그래서 네트워크(공개키 받기)와 검증 로직을 갈라놓았다 — 검증은 자체 키쌍으로 만든
 * 가짜 콜백으로 노드에서 그대로 증명할 수 있어야 한다(키 조회를 주입받는 이유).
 *
 * 구글 문서의 규칙 그대로:
 *  1. 공개키 목록을 verifier-keys.json에서 받아 **캐시**한다. key_id가 없으면 한 번 재조회.
 *  2. 서명 대상은 쿼리스트링에서 `&signature=` **앞까지의 원본 문자열**이다.
 *  3. signature는 base64url, 공개키는 base64 DER(SPKI), ECDSA 서명은 DER 인코딩.
 *  4. timestamp가 너무 오래된 콜백은 거부한다(재전송 공격 차단).
 */
import { Injectable, Logger } from '@nestjs/common';
import { createPublicKey, createVerify } from 'node:crypto';

/** 구글이 공개키를 올려두는 곳. gstatic.com은 www로 301 → fetch가 따라가지만 최종 주소를 직접 쓴다. */
const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

/** 이보다 오래된 콜백은 버린다. 구글 재시도는 보통 분 단위라 1시간이면 넉넉하다. */
const MAX_AGE_MS = 60 * 60 * 1000;

/** 서명이 검증된 뒤에만 신뢰할 수 있는 값들. reward_amount는 쓰지 않는다 — 금액은 서버가 정한다. */
export type SsvParams = {
  transactionId: string;
  userId: string;
  timestampMs: number;
};

export type SsvVerifyResult = { ok: true; params: SsvParams } | { ok: false; reason: string };

/**
 * key_id → 공개키(base64 DER SPKI). 모르는 키면 null.
 * 캐시·재조회는 구현의 책임이다. 테스트는 여기에 자체 키쌍의 공개키를 꽂는다.
 */
export type SsvKeyLookup = (keyId: string) => Promise<string | null>;

/**
 * 콜백 쿼리스트링('?' 뒤 전체, **원본 그대로**)을 검증한다.
 *
 * rawQuery를 파싱해서 재조립하면 순서와 인코딩이 달라져 서명이 반드시 깨진다.
 * 그래서 서명 대상은 문자열을 자른 것이고, 값 읽기만 URLSearchParams로 한다.
 */
export async function verifySsvCallback(
  rawQuery: string,
  lookupKey: SsvKeyLookup,
  now: number = Date.now(),
): Promise<SsvVerifyResult> {
  // signature와 key_id는 항상 쿼리의 마지막 두 개다. 그 앞까지가 서명 대상.
  const sigAt = rawQuery.indexOf('&signature=');
  if (sigAt < 0) return { ok: false, reason: 'signature 파라미터 없음' };
  const signedPart = rawQuery.slice(0, sigAt);

  const params = new URLSearchParams(rawQuery);
  const signature = params.get('signature');
  const keyId = params.get('key_id');
  const transactionId = params.get('transaction_id');
  const userId = params.get('user_id');
  const timestamp = params.get('timestamp');
  if (!signature || !keyId || !transactionId || !userId || !timestamp) {
    return { ok: false, reason: '필수 파라미터 누락' };
  }

  const publicKeyBase64 = await lookupKey(keyId);
  if (!publicKeyBase64) return { ok: false, reason: `모르는 key_id(${keyId})` };

  let verified = false;
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    verified = createVerify('SHA256')
      .update(signedPart)
      // dsaEncoding: ECDSA 서명이 DER(ASN.1)이다. 기본값('der')이지만 명시한다 —
      // 'ieee-p1363'로 잘못 두면 모든 검증이 실패한다.
      .verify({ key, dsaEncoding: 'der' }, Buffer.from(signature, 'base64url'));
  } catch {
    // 키가 깨졌거나 서명 바이트가 서명 형식이 아닌 경우. 거부와 똑같이 다룬다.
    return { ok: false, reason: '서명 검증 오류' };
  }
  if (!verified) return { ok: false, reason: '서명 불일치' };

  // timestamp는 epoch 밀리초. 서명이 맞은 뒤에 본다 — 그 전엔 믿을 값이 아니다.
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) return { ok: false, reason: 'timestamp 형식 오류' };
  if (now - timestampMs > MAX_AGE_MS) return { ok: false, reason: 'timestamp 만료' };

  return { ok: true, params: { transactionId, userId, timestampMs } };
}

/**
 * 구글 공개키 캐시. 콜백마다 받으면 느리고, 구글이 잠깐 느려지면 적립이 멈춘다.
 * 키는 교체되므로 **모르는 key_id가 오면 한 번만** 다시 받는다(모르는 키로 계속
 * 두드리는 공격에 매 요청 외부 호출을 하지 않도록 재조회 간격을 둔다).
 */
@Injectable()
export class SsvKeyCache {
  private readonly logger = new Logger(SsvKeyCache.name);
  /** key_id → base64 DER 공개키. */
  private keys = new Map<string, string>();
  private lastFetchAt = 0;

  /** verifySsvCallback에 넘길 조회 함수. this가 묶이도록 화살표 프로퍼티로 둔다. */
  readonly lookup: SsvKeyLookup = async (keyId) => {
    const cached = this.keys.get(keyId);
    if (cached) return cached;
    // 캐시에 없다 = 키가 교체됐거나 첫 호출이다. 1분 안에 이미 받아왔다면 다시 받지 않는다.
    if (Date.now() - this.lastFetchAt < 60_000) return null;
    await this.refresh();
    return this.keys.get(keyId) ?? null;
  };

  private async refresh(): Promise<void> {
    this.lastFetchAt = Date.now();
    const res = await fetch(VERIFIER_KEYS_URL);
    if (!res.ok) throw new Error(`verifier-keys.json ${res.status}`);
    // 형식: { keys: [{ keyId: 3335741209, pem: "...", base64: "MFkwEw..." }] }
    // keyId가 숫자라 쿼리의 문자열 key_id와 맞추려면 String()으로 돌린다.
    const body = (await res.json()) as { keys?: { keyId: number; base64: string }[] };
    const next = new Map<string, string>();
    for (const k of body.keys ?? []) next.set(String(k.keyId), k.base64);
    if (next.size === 0) throw new Error('verifier-keys.json에 키가 없음');
    this.keys = next;
    this.logger.log(`AdMob 공개키 ${next.size}개 갱신 (key_id: ${[...next.keys()].join(', ')})`);
  }
}
