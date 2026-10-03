/**
 * UserRepository — User DB 접근 "계약". 구현은 user.repository.prisma.ts.
 * service는 이 계약만 보고 일한다(DB 종류 모름). word.repository.ts와 동일 패턴.
 */
import { UserEntity } from './entities/user.entity';

export abstract class UserRepository {
  /** 이메일로 1명 조회. 없으면 null. (가입 중복 검사·로그인에 사용) */
  abstract findByEmail(email: string): Promise<UserEntity | null>;

  /** id로 존재 여부만 확인. 토큰이 가리키는 계정이 아직 있는지 보는 용도. */
  abstract existsById(userId: string): Promise<boolean>;

  /** 새 사용자 생성. (해싱된 비밀번호를 받는다 — 해싱은 service 책임. nickname은 가입 시 자동 배정값) */
  abstract create(input: {
    email: string;
    passwordHash: string;
    nickname?: string;
  }): Promise<UserEntity>;

  /** 프로필 완성/수정. 관심사는 입력셋으로 통째 교체. 갱신된 사용자 반환. */
  abstract updateProfile(
    userId: string,
    input: { birthYear: number; gender: string; interests: string[] },
  ): Promise<UserEntity>;

  /** 닉네임으로 1명 조회. 없으면 null. (닉네임 중복 검사에 사용) */
  abstract findByNickname(nickname: string): Promise<UserEntity | null>;

  /** 닉네임 설정/변경. null = 미설정으로 되돌리기. 갱신된 사용자 반환. */
  abstract updateNickname(userId: string, nickname: string | null): Promise<UserEntity>;

  /** 소셜 연결로 1명 조회. 없으면 null. (provider, providerSub) 쌍이 계정의 정체성. */
  abstract findBySocial(provider: string, providerSub: string): Promise<UserEntity | null>;

  /**
   * 소셜 전용 사용자 생성 — 이메일·비밀번호 없이 만든다.
   * 유저와 연결(AuthIdentity)을 한 트랜잭션으로 만들어, 유저만 남고 연결이 없는
   * 고아 계정이 생기지 않게 한다(그런 계정은 다시는 로그인할 수 없다).
   */
  abstract createSocial(input: {
    provider: string;
    providerSub: string;
    nickname?: string;
  }): Promise<UserEntity>;

  /** 이 사용자의 소셜 연결 목록. 탈퇴 시 제공자 쪽 연결도 끊어야 해서 필요하다. */
  abstract findIdentities(userId: string): Promise<{ provider: string; providerSub: string }[]>;

  /**
   * 회원 탈퇴 — 사용자와 딸린 데이터를 지운다.
   * entries·likes·interests·identities는 스키마의 onDelete: Cascade가 함께 지운다.
   * LlmUsage는 FK가 없는 비용 원장이라 **userId만 지워 익명화**한다
   * (집계는 남기되 사람과의 연결은 끊는다).
   */
  abstract deleteUser(userId: string): Promise<void>;
}
