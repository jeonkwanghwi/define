/**
 * CurrencyRepository — User의 재화(balance)·출석일 접근 계약. 구현은 .prisma.ts.
 * auth의 UserRepository와 같은 user 테이블을 보지만, currency가 필요한 필드만 다룬다.
 */
export type BalanceState = { balance: number; lastAttendanceDate: string | null };

export abstract class CurrencyRepository {
  /** 잔액 + 마지막 출석 적립일 조회. 사용자 없으면 null. */
  abstract findState(userId: string): Promise<BalanceState | null>;

  /** balance += amount, lastAttendanceDate = localDate. 갱신된 balance 반환. */
  abstract grantAttendance(userId: string, amount: number, localDate: string): Promise<number>;

  /** balance >= cost 일 때만 원자적 차감. 차감되면 {ok:true}, 부족/없음이면 {ok:false}. balance=차감 후(또는 현재). */
  abstract spend(userId: string, cost: number): Promise<{ ok: boolean; balance: number }>;

  /** 마지막으로 보상한 최고 연속 기록일. 없으면 0. */
  abstract getLastRewardedStreakDay(userId: string): Promise<number>;

  /**
   * lastRewardedStreakDay < streak 일 때만 원자적으로 balance += amount, marker = streak.
   * granted=false면 동시성으로 이미 처리됨(이중지급 방지). balance=현재.
   */
  abstract grantRecord(
    userId: string,
    amount: number,
    streak: number,
  ): Promise<{ granted: boolean; balance: number }>;
}
