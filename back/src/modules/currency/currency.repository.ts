/**
 * CurrencyRepository — User의 재화(balance)·출석일 접근 계약. 구현은 .prisma.ts.
 * auth의 UserRepository와 같은 user 테이블을 보지만, currency가 필요한 필드만 다룬다.
 */
export type BalanceState = { balance: number; lastAttendanceDate: string | null };

export abstract class CurrencyRepository {
  /** 잔액 + 마지막 출석 적립일 조회. 사용자 없으면 null. */
  abstract findState(userId: string): Promise<BalanceState | null>;

  /**
   * lastAttendanceDate가 없거나 localDate보다 이전일 때만 원자적으로 balance += amount, 날짜 = localDate.
   * granted=false면 같은 날 다른 요청이 먼저 받아갔다(동시 요청 이중 지급 방지). balance=현재.
   */
  abstract grantAttendance(
    userId: string,
    amount: number,
    localDate: string,
  ): Promise<{ granted: boolean; balance: number }>;

  /** balance >= cost 일 때만 원자적 차감. 차감되면 {ok:true}, 부족/없음이면 {ok:false}. balance=차감 후(또는 현재). */
  abstract spend(userId: string, cost: number): Promise<{ ok: boolean; balance: number }>;

  /** balance += amount — 차감 후 일이 실패했을 때 되돌려주는 용도. 갱신된 balance 반환. */
  abstract refund(userId: string, amount: number): Promise<number>;

  /**
   * 오늘(한국 날짜) 아직 기록 보너스를 안 받았을 때만 원자적으로 balance += amount, 마커 = today.
   * granted=false면 오늘 이미 받음(동시 요청 포함 — 이중지급 방지). balance=현재.
   */
  /**
   * 정의 보상 — 오늘(today) 이미 준 개수(used)를 보고 cap까지만 newEntries개에 perEntry씩 준다. 원자적.
   * 날짜가 바뀌었으면 used=0부터. 반환 amount=이번에 준 잉크(0일 수 있음), countToday=오늘 누적 개수.
   */
  abstract grantEntryRewards(
    userId: string,
    newEntries: number,
    today: string,
    perEntry: number,
    cap: number,
  ): Promise<{ amount: number; countToday: number; balance: number }>;

  abstract grantRecord(
    userId: string,
    amount: number,
    today: string,
  ): Promise<{ granted: boolean; balance: number }>;
}
