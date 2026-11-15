/**
 * apiRequest 재시도 점검. 실행: node scripts/check-api-retry.mts
 * 첫 fetch는 "연결 끊김"(TypeError), 두 번째는 성공하는 가짜 fetch로 확인한다.
 */
import assert from 'node:assert/strict';

let calls = 0;
let failTimes = 1;
globalThis.fetch = (async () => {
  calls++;
  if (calls <= failTimes) throw new TypeError('Network request failed');
  return new Response('{"ok":true}', { status: 200 });
}) as typeof fetch;

const { apiRequest } = await import('../src/services/api-client.ts');

// 1) 켜면 한 번 더 보내서 성공
calls = 0; failTimes = 1;
assert.deepEqual(await apiRequest('/x', { method: 'POST', retryOnNetworkError: true }), { ok: true });
assert.equal(calls, 2);

// 2) 끄면(기본) 다시 보내지 않고 안내 문구로 실패
calls = 0; failTimes = 1;
await assert.rejects(apiRequest('/x', { method: 'POST' }), { status: 0, message: '인터넷 연결을 확인하고 다시 시도해 주세요.' });
assert.equal(calls, 1);

// 3) 두 번 다 끊기면 한 번만 더 보내고 같은 안내로 실패
calls = 0; failTimes = 2;
await assert.rejects(apiRequest('/x', { method: 'POST', retryOnNetworkError: true }), { status: 0 });
assert.equal(calls, 2);

// 4) 시간 초과는 다시 보내지 않는다
calls = 0;
globalThis.fetch = ((_u: string, init: RequestInit) =>
  new Promise((_, reject) => {
    calls++;
    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  })) as typeof fetch;
await assert.rejects(apiRequest('/x', { method: 'POST', retryOnNetworkError: true, timeoutMs: 50 }), {
  message: '서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.',
});
assert.equal(calls, 1);

console.log('ok');
