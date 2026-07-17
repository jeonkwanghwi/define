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

  /** 프로필 완성/수정. 관심사는 입력셋으로 통째 교체. 갱신된 사용자 반환. */
  abstract updateProfile(
    userId: string,
    input: { birthYear: number; gender: string; interests: string[] },
  ): Promise<UserEntity>;

  /** 닉네임으로 1명 조회. 없으면 null. (닉네임 중복 검사에 사용) */
  abstract findByNickname(nickname: string): Promise<UserEntity | null>;

  /** 닉네임 설정/변경. null = 미설정으로 되돌리기. 갱신된 사용자 반환. */
  abstract updateNickname(userId: string, nickname: string | null): Promise<UserEntity>;
}
