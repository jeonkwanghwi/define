import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CurrencyRepository } from './currency.repository';
import { recordRewardForDay } from './record-reward';

/** 출석 1회 적립액(잉크). v1 고정 상수. */
export const ATTENDANCE_AMOUNT = 10;

export type AttendanceResult = { balance: number; claimed: boolean; amount: number };
export type RecordBonus = { milestone: number; amount: number; balance: number };

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
    const balance = await this.currency.grantAttendance(userId, ATTENDANCE_AMOUNT, localDate);
    return { balance, claimed: true, amount: ATTENDANCE_AMOUNT };
  }

  /** balance >= cost 면 원자적 차감 후 {ok:true,balance}. 부족하면 {ok:false,balance}. */
  async spend(userId: string, cost: number): Promise<{ ok: boolean; balance: number }> {
    return this.currency.spend(userId, cost);
  }

  /** 현재 잔액. 없으면 0. */
  async getBalance(userId: string): Promise<number> {
    const state = await this.currency.findState(userId);
    return state?.balance ?? 0;
  }

  /**
   * 연속 기록 streak에 대해 (마지막 보상, streak] 구간 보상을 합산 지급. 멱등.
   * 새로 줄 게 없으면(이미 보상했거나 구간 합 0) null.
   */
  async grantRecordMilestone(userId: string, streak: number): Promise<RecordBonus | null> {
    const last = await this.currency.getLastRewardedStreakDay(userId);
    if (streak <= last) return null;
    let amount = 0;
    for (let d = last + 1; d <= streak; d++) amount += recordRewardForDay(d);
    if (amount === 0) return null;
    const { granted, balance } = await this.currency.grantRecord(userId, amount, streak);
    if (!granted) return null;
    return { milestone: streak, amount, balance };
  }
}
