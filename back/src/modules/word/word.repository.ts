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
}
