/**
 * EmailCodeRepository — 인증 코드 저장 계약. 구현은 Prisma(=email-code.repository.prisma.ts).
 * UserRepository와 같은 패턴: 서비스는 이 추상 클래스만 알고 DB를 모른다.
 */
export type EmailCodeRow = {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
};

export abstract class EmailCodeRepository {
  /** 새 코드 1건 저장. */
  abstract create(input: {
    email: string;
    purpose: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;

  /** 아직 쓰지 않은 가장 최근 코드 1건. 없으면 null. */
  abstract findLatestUnconsumed(email: string, purpose: string): Promise<EmailCodeRow | null>;

  /** 확인 시도 1회 기록. */
  abstract incrementAttempts(id: string): Promise<void>;

  /** 사용 완료 처리(consumedAt = now). */
  abstract consume(id: string): Promise<void>;

  /** 같은 (email, purpose)의 미사용 코드를 전부 폐기 — 재발송·시도초과 시. */
  abstract consumeAll(email: string, purpose: string): Promise<void>;

  /** since 이후 발급 건수 — 레이트리밋 판정용. */
  abstract countSince(email: string, purpose: string, since: Date): Promise<number>;

  /** 가장 최근 발급 시각. 없으면 null — 재발송 쿨다운 판정용. */
  abstract lastIssuedAt(email: string, purpose: string): Promise<Date | null>;
}
