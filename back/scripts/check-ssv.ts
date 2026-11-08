/**
 * SSV 서명 검증 자체 점검. 실행: `npx ts-node scripts/check-ssv.ts`
 * 구글은 쿼리를 **URL 디코딩한 문자열**에 서명한다(Tink RewardedAdsVerifier가 uri.getQuery() 사용).
 * 자체 키쌍으로 그렇게 서명한 가짜 콜백을 만들어, 인코딩된 값(%EC..)이 섞여도 통과하는지 본다.
 */
import * as assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';

import { verifySsvCallback } from '../src/modules/ads/ssv-verifier';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const lookup = async (id: string) => (id === '1' ? pub : null);

const now = Date.now();
// reward_item=잉크 처럼 인코딩되는 값이 들어간 실제 형태의 쿼리.
const raw = `ad_network=5450213213286189855&ad_unit=9712302007&reward_amount=10&reward_item=${encodeURIComponent('잉크 10')}&timestamp=${now}&transaction_id=tx1&user_id=u1`;
const sig = createSign('SHA256').update(decodeURIComponent(raw)).sign(privateKey).toString('base64url');

void (async () => {
  const ok = await verifySsvCallback(`${raw}&signature=${sig}&key_id=1`, lookup, now);
  assert.deepEqual(ok, { ok: true, params: { transactionId: 'tx1', userId: 'u1', timestampMs: now } });

  // 값을 바꾸면 거부된다.
  const bad = await verifySsvCallback(`${raw.replace('u1', 'u2')}&signature=${sig}&key_id=1`, lookup, now);
  assert.deepEqual(bad, { ok: false, reason: '서명 불일치' });

  console.log('ok');
})();
