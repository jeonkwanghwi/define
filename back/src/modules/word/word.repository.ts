/**
 * WordRepository — DB 접근 "인터페이스"(계약). 구현은 따로(word.repository.prisma.ts).
 *
 * 왜 abstract class인가:
 *   - service는 이 "계약"만 보고 일한다. SQLite인지 Postgres인지 Mongo인지 모름.
 *   - 나중에 DB를 바꾸면 새 구현체를 만들고 module에서 바인딩만 교체 → service 코드 무변경.
 *   - TypeScript의 interface는 런타임에 사라져서 NestJS가 주입 키로 못 쓴다.
 *     abstract class는 런타임에 남아 "주입 키 + 계약"을 겸할 수 있어 이 패턴의 표준.
 */
import { WordEntity } from './entities/word.entity';

export abstract class WordRepository {
  /** 추천 단어 전체를 생성순으로 반환. */
  abstract findAll(): Promise<WordEntity[]>;

  /** 추천에 쓸 수 있는 단어(active: true)만. 끈 단어는 정의 보존용으로 DB에 남아 있다. */
  abstract findActive(): Promise<WordEntity[]>;

  /** 이 사용자의 관심사 태그. 프로필 미완성이면 빈 배열. */
  abstract findInterests(userId: string): Promise<string[]>;

  /**
   * 이 사용자가 since 이후에 정의한 단어들(중복 제거).
   * "영구히 정의한 적 있는 단어"가 아니다 — 이유는 word.service.ts 참조.
   */
  abstract findDefinedWordsSince(userId: string, since: Date): Promise<string[]>;
}
