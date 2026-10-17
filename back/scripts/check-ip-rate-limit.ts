/**
 * IP 레이트 리밋 자체 점검. 실행: `npx ts-node scripts/check-ip-rate-limit.ts`
 * ① 카운팅·창(window) 만료 ② trust proxy 2가 X-Forwarded-For에서 사용자 IP를 고르는지.
 */
import * as assert from 'node:assert/strict';
import * as http from 'node:http';

import express = require('express');

import { IpRateLimit } from '../src/common/ip-rate-limit.guard';

const g = new IpRateLimit(3, 1000);
assert.equal(g.take('a', 0), true);
assert.equal(g.take('a', 1), true);
assert.equal(g.take('a', 2), true);
assert.equal(g.take('a', 3), false, '4번째는 막혀야 한다');
assert.equal(g.take('b', 3), true, '다른 IP는 따로 센다');
assert.equal(g.take('a', 1001), true, '창이 지나면 다시 열린다');

// main.ts와 같은 설정으로, CloudFront→ALB가 만드는 헤더 모양을 흉내 낸다.
const app = express();
app.set('trust proxy', 2);
app.get('/', (req, res) => res.send(req.ip));
const server = app.listen(0, async () => {
  const port = (server.address() as { port: number }).port;
  const ipFor = (xff?: string) =>
    new Promise<string>((ok) =>
      http.get({ port, headers: xff ? { 'x-forwarded-for': xff } : {} }, (r) => {
        let b = '';
        r.on('data', (c) => (b += c)).on('end', () => ok(b));
      }),
    );
  // 정상: [사용자, CloudFront 엣지]
  assert.equal(await ipFor('203.0.113.7, 130.176.1.1'), '203.0.113.7');
  // 위조: 사용자가 맨 앞에 가짜를 써 보내도 CloudFront가 붙인 진짜가 뽑힌다
  assert.equal(await ipFor('6.6.6.6, 203.0.113.7, 130.176.1.1'), '203.0.113.7');
  server.close();
  console.log('ip-rate-limit: OK');
});
