import { Injectable, NotFoundException } from '@nestjs/common';

import { CurrencyRepository } from './currency.repository';

/** 출석 1회 적립액(잉크). v1 고정 상수. */
export const ATTENDANCE_AMOUNT = 10;

export type AttendanceResult = { balance: number; claimed: boolean; amount: number };

@Injectable()
export class CurrencyService {
  constructor(private readonly currency: CurrencyRepository) {}

  /**
   * 오늘 처음 호출이면 +ATTENDANCE_AMOUNT, 이미 받았으면 무지급. 멱등.
   * '오늘' = 클라가 보낸 localDate. lastAttendanceDate와 다르면 신규 출석.
   */
  async claimAttendance(userId: string, localDate: string): Promise<AttendanceResult> {
    const state = await this.currency.findState(userId);
    if (!state) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    if (state.lastAttendanceDate === localDate) {
      return { balance: state.balance, claimed: false, amount: ATTENDANCE_AMOUNT };
    }
    const balance = await this.currency.grantAttendance(userId, ATTENDANCE_AMOUNT, localDate);
    return { balance, claimed: true, amount: ATTENDANCE_AMOUNT };
  }
}
