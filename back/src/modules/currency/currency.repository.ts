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
}
