/**
 * UserRepository — User DB 접근 "계약". 구현은 user.repository.prisma.ts.
 * service는 이 계약만 보고 일한다(DB 종류 모름). word.repository.ts와 동일 패턴.
 */
import { UserEntity } from './entities/user.entity';

export abstract class UserRepository {
  /** 이메일로 1명 조회. 없으면 null. (가입 중복 검사·로그인에 사용) */
  abstract findByEmail(email: string): Promise<UserEntity | null>;

  /** 새 사용자 생성. (해싱된 비밀번호를 받는다 — 해싱은 service 책임) */
  abstract create(input: { email: string; passwordHash: string }): Promise<UserEntity>;
}
