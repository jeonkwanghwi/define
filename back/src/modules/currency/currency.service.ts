import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CurrencyRepository } from './currency.repository';
import { recordRewardForDay } from './record-reward';

/** 출석 1회 적립액(잉크). v1 고정 상수. */
export const ATTENDANCE_AMOUNT = 10;

export type AttendanceResult = { balance: number; claimed: boolean; amount: number };
export type RecordBonus = { milestone: number; amount: number; balance: number };
export type EntryReward = { amount: number; countToday: number; balance: number };

/** 정의 1개당 잉크 · 하루 상한(개수). 사용자 결정 2026-11-15 — 광장 도배를 막으려 상한을 둔다. */
export const ENTRY_REWARD_AMOUNT = 3;
export const ENTRY_DAILY_CAP = 5;

@Injectable()
export class CurrencyService {
  constructor(private readonly currency: CurrencyRepository) {}

  /**
   * 오늘 처음 호출이면 +ATTENDANCE_AMOUNT, 이미 받았으면 무지급. 멱등.
   * '오늘' = 클라가 보낸 localDate. 단 서버가 권위로 검증(임의 날짜 반복 적립 차단):
   *  - 서버 UTC 날짜 ±1일 밖이면 400 — 전 세계 시간대(UTC-12~+14)의 로컬 날짜는 이 창 안에 들어옴
   *  - 마지막 적립일보다 이전이거나 같으면 무지급 — 날짜를 되돌려 보내는 파밍 차단
   */
  async claimAttendance(userId: string, localDate: string): Promise<AttendanceResult> {
    const state = await this.currency.findState(userId);
    if (!state) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    const serverUtcDay = Date.parse(new Date().toISOString().slice(0, 10));
    const claimDay = Date.parse(localDate); // YYYY-MM-DD → UTC 자정 (DTO가 형식 보장)
    const DAY_MS = 86_400_000;
    if (Number.isNaN(claimDay) || Math.abs(claimDay - serverUtcDay) > DAY_MS) {
      throw new BadRequestException('날짜가 올바르지 않습니다.');
    }
    // YYYY-MM-DD는 문자열 비교 = 시간순 비교.
    if (state.lastAttendanceDate !== null && localDate <= state.lastAttendanceDate) {
      return { balance: state.balance, claimed: false, amount: ATTENDANCE_AMOUNT };
    }
    // 위 검사는 빠른 길일 뿐, 진짜 관문은 조건부 UPDATE다(동시 요청 중 하나만 granted).
    const { granted, balance } = await this.currency.grantAttendance(
      userId,
      ATTENDANCE_AMOUNT,
      localDate,
    );
    return { balance, claimed: granted, amount: ATTENDANCE_AMOUNT };
  }

  /** balance >= cost 면 원자적 차감 후 {ok:true,balance}. 부족하면 {ok:false,balance}. */
  async spend(userId: string, cost: number): Promise<{ ok: boolean; balance: number }> {
    return this.currency.spend(userId, cost);
  }

  /** 차감을 되돌린다(차감 뒤 외부 호출이 실패했을 때). 갱신된 잔액. */
  refund(userId: string, amount: number): Promise<number> {
    return this.currency.refund(userId, amount);
  }

  /** 현재 잔액. 없으면 0. */
  async getBalance(userId: string): Promise<number> {
    const state = await this.currency.findState(userId);
    return state?.balance ?? 0;
  }

  /**
   * 기록 연속 보너스 — **오늘(한국 날짜) 첫 기록**에 그날 연속일만큼의 보상을 한 번 준다. 멱등.
   *
   * 예전엔 "지금까지 보상한 최고 연속일"을 넘을 때만 줬다 → 10일 연속 뒤 하루 쉬면 11일 연속이
   * 될 때까지 보너스가 0이었다(2026-11-15 수정). 이제 마커는 날짜라, 끊기면 1일째(+3)부터 다시 받는다.
   * 여러 날치를 몰아서 주지 않는다 — 날짜는 서버가 받은 시각(createdAt)이라 몰아 올릴 수도 없다.
   * 오늘 받을 게 없으면(오늘 기록 없음·그날 보상 0·이미 받음) null.
   */
  /**
   * 정의 보상 — 이번 동기화에서 **새로 생긴** 정의 개수만큼 +3, 오늘(한국 날짜) 5개까지. 멱등에 가깝다:
   * 같은 글을 다시 보내면 새로 생긴 게 0이라 주지 않고, 지웠다 다시 써도 그날 센 개수는 줄지 않는다.
   * 줄 게 없으면 null.
   */
  async grantEntryRewards(userId: string, newEntries: number, today: string): Promise<EntryReward | null> {
    if (newEntries <= 0) return null;
    const r = await this.currency.grantEntryRewards(userId, newEntries, today, ENTRY_REWARD_AMOUNT, ENTRY_DAILY_CAP);
    return r.amount > 0 ? r : null;
  }

  async grantRecordMilestone(
    userId: string,
    streak: number,
    recordedToday: boolean,
    today: string,
  ): Promise<RecordBonus | null> {
    if (!recordedToday || streak === 0) return null;
    const amount = recordRewardForDay(streak);
    if (amount === 0) return null;
    const { granted, balance } = await this.currency.grantRecord(userId, amount, today);
    if (!granted) return null;
    return { milestone: streak, amount, balance };
  }
}
