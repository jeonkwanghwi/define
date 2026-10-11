/**
 * AdRewardRepository — 광고 보상 지급 기록 접근 계약. 구현은 .prisma.ts.
 * currency.repository.ts와 같은 패턴. service는 DB가 Prisma인지 모른다.
 */

/**
 * 지급 시도의 결말. 호출자가 HTTP 코드를 고르는 근거다.
 *  - granted   : 지급됐다
 *  - duplicate : 같은 transactionId가 이미 있다(구글이 재시도한 콜백)
 *  - limit     : 오늘 상한을 다 썼다
 *  - no-user   : 그런 사용자가 없다(탈퇴한 사용자의 뒤늦은 콜백)
 * granted 말고는 전부 "우리가 처리하지 않기로 했다"다 — 구글에겐 200으로 답한다.
 */
export type GrantOutcome = 'granted' | 'duplicate' | 'limit' | 'no-user';

export abstract class AdRewardRepository {
  /** since 이후 이 사용자에게 지급한 건수. 남은 횟수 표시에 쓴다. */
  abstract countSince(userId: string, since: Date): Promise<number>;

  /**
   * 상한 확인 + 기록 생성 + 잔액 증가를 **한 트랜잭션으로** 처리한다.
   *
   * 세 가지를 한 덩어리로 묶는 이유: 상한을 서비스에서 먼저 세고 따로 지급하면,
   * 콜백이 겹쳐 들어온 순간 둘 다 "아직 4건"을 보고 6건을 지급할 수 있다. 돈이 걸린
   * 경로라 레이스를 코드 순서에 맡기지 않는다(중복은 transactionId 유니크가 막는다).
   */
  abstract grant(input: {
    transactionId: string;
    userId: string;
    amount: number;
    dailyLimit: number;
    since: Date;
  }): Promise<GrantOutcome>;
}
