import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { AdRewardRepository } from './ad-reward.repository';
import { SsvKeyCache, verifySsvCallback } from './ssv-verifier';

/** 광고 1회 보상. 서버가 정하는 값이다 — AdMob 콘솔의 수량은 표시용일 뿐이다. */
export const AD_REWARD_AMOUNT = 10;
/** 하루 받을 수 있는 횟수. 회상 1건이 30이므로 5회면 하루 최대 2건쯤 가능하다. */
export const AD_DAILY_LIMIT = 5;

export type AdQuota = { remaining: number; limit: number; amount: number };

/**
 * '오늘'의 시작(KST). 상한을 세는 창이다.
 *
 * UTC 자정으로 끊으면 한국에선 오전 9시에 횟수가 초기화돼 "내일 다시"라는 안내와 어긋난다.
 * 클라가 보낸 날짜를 쓰지도 않는다 — SSV 콜백은 구글이 부르므로 클라의 날짜가 없고,
 * 있다 해도 상한을 세는 기준을 클라에게 맡기면 날짜를 바꿔 보내 무한 적립이 된다.
 * 사용자가 한국 사용자뿐이라 고정 UTC+9로 끊는다.
 */
function startOfTodayKst(now: Date = new Date()): Date {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = now.getTime() + KST_OFFSET_MS;
  const kstMidnight = Math.floor(kstNow / 86_400_000) * 86_400_000;
  return new Date(kstMidnight - KST_OFFSET_MS);
}

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly rewards: AdRewardRepository,
    private readonly keyCache: SsvKeyCache,
  ) {}

  /**
   * SSV 콜백 1건을 처리한다. rawQuery는 '?' 뒤의 **원본 쿼리스트링**이다.
   *
   * **HTTP 코드를 어떻게 고르는가** — 구글은 비200을 받으면 같은 콜백을 계속 재시도한다.
   * 그래서 "우리가 처리하지 않기로 했다"와 "우리 서버가 고장났다"를 갈라야 한다:
   *   - 서명 불일치/만료 → **403**. 이건 구글이 보낸 게 아니다(또는 조작됐다). 재시도할 이유가 없다.
   *   - 중복·상한초과·탈퇴한 사용자 → **200**. 우리 판단으로 적립을 안 한 것이고, 구글이
   *     몇 번을 다시 보내도 결과가 같다. 200을 줘야 재시도가 멈춘다.
   *   - DB 오류 → 예외를 그대로 올려 **500**. 이건 진짜 실패라 재시도를 받아야 한다
   *     (transactionId 유니크가 있어 재시도가 이중지급이 되지 않는다).
   */
  async grantFromSsv(rawQuery: string): Promise<void> {
    const result = await verifySsvCallback(rawQuery, this.keyCache.lookup);
    if (!result.ok) {
      this.logger.warn(`SSV 서명 거부: ${result.reason}`);
      throw new ForbiddenException('서명을 확인할 수 없습니다.');
    }

    const { transactionId, userId } = result.params;
    const outcome = await this.rewards.grant({
      transactionId,
      userId,
      amount: AD_REWARD_AMOUNT,
      dailyLimit: AD_DAILY_LIMIT,
      since: startOfTodayKst(),
    });
    if (outcome === 'granted') {
      this.logger.log(`광고 보상 +${AD_REWARD_AMOUNT} user=${userId} tx=${transactionId}`);
    } else {
      // 전부 정상적으로 일어나는 일이다. 그래서 예외가 아니라 로그 한 줄로 끝낸다.
      this.logger.log(`광고 보상 미지급(${outcome}) user=${userId} tx=${transactionId}`);
    }
  }

  /** 오늘 남은 횟수. 앱이 버튼에 "오늘 N번 더 받을 수 있어요"를 그리는 재료. */
  async getQuota(userId: string): Promise<AdQuota> {
    const used = await this.rewards.countSince(userId, startOfTodayKst());
    return {
      remaining: Math.max(0, AD_DAILY_LIMIT - used),
      limit: AD_DAILY_LIMIT,
      amount: AD_REWARD_AMOUNT,
    };
  }
}
