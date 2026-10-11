/**
 * WordService — 비즈니스 로직 계층. controller(HTTP)와 repository(DB) 사이.
 *
 * "단어 목록을 응답 형태(DTO)로 변환"에 더해, 홈의 "오늘의 단어" 추천 규칙이 여기 있다.
 *
 * 핵심: wordRepository는 인터페이스(abstract)다. DB 종류를 모른다 → 로직과 DB가 분리됨.
 */
import { Injectable } from '@nestjs/common';

import { RecommendedWordsResponse, WordResponse } from './dto/word.response';
import { WordEntity } from './entities/word.entity';
import { WordRepository } from './word.repository';

/** 관심사에서 뽑을 비율. 전부 관심사에서 주면 추천이 잘 맞을수록 세계가 좁아진다. */
const INTEREST_RATIO = 0.7;

/**
 * 최근 이 기간 안에 정의한 단어만 추천에서 뺀다. **영구 제외가 아니다.**
 *
 * 같은 단어를 다시 정의해 생각의 변화를 보는 것이 이 앱의 핵심이다(단어장에 재정의 기능이
 * 따로 있다). 석 달이면 계절이 한 번 바뀌고, 그 간격이 있어야 '그때의 나'와 비교가 된다.
 * 영구 제외하면 그 핵심을 홈이 막고, 252개를 다 쓴 뒤엔 뽑을 단어가 마른다.
 */
const RECENT_WORD_EXCLUSION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WordService {
  // NestJS가 module 바인딩을 보고 알맞은 구현체(PrismaWordRepository)를 자동 주입한다.
  constructor(private readonly wordRepository: WordRepository) {}

  /** 추천 단어 전체를 응답 DTO 목록으로. */
  async listWords(): Promise<WordResponse[]> {
    const words = await this.wordRepository.findAll();
    return words.map((word) => new WordResponse({ id: word.id, text: word.text }));
  }

  /**
   * 홈에 내려줄 추천 단어 풀. userId가 null이면(비로그인) 전체에서 뽑는다.
   *
   * **빈 배열을 돌려주지 않는다.** 비로그인·관심사 없음·최근에 다 정의함, 어느 경우든
   * 전체 풀로 되돌아간다. 홈이 비면 사용자에겐 앱이 고장 난 것으로 보인다.
   *
   * gender는 쓰지 않는다 — 성별로 다른 단어를 권하면 고정관념이 되고,
   * 개인정보처리방침에 "통계로만 쓴다"고 적어 두었다.
   */
  async recommend(userId: string | null, limit: number): Promise<RecommendedWordsResponse> {
    const all = await this.wordRepository.findActive();

    let pool = all;
    let interests: string[] = [];
    if (userId) {
      const since = new Date(Date.now() - RECENT_WORD_EXCLUSION_DAYS * DAY_MS);
      const [recentWords, userInterests] = await Promise.all([
        this.wordRepository.findDefinedWordsSince(userId, since),
        this.wordRepository.findInterests(userId),
      ]);
      interests = userInterests;

      const recent = new Set(recentWords);
      const remaining = all.filter((word) => !recent.has(word.text));
      // 제외하고 남는 게 없으면 제외를 포기한다(빈 홈보다 중복이 낫다).
      if (remaining.length > 0) pool = remaining;
    }

    // 관심사가 없으면 A 풀도 없다 → 전부 전체 풀에서 뽑힌다.
    const interestPool = interests.length
      ? pool.filter((word) => word.tags.some((tag) => interests.includes(tag)))
      : [];

    const picked = this.mix(interestPool, pool, limit);
    // 섞어서 반환 — 순서에 규칙(관심사 먼저 등)이 보이면 추천이 아니라 목록이 된다.
    return new RecommendedWordsResponse({ words: shuffle(picked).map((word) => word.text) });
  }

  /**
   * 10개 중 7개는 관심사 풀(A)에서, 나머지는 전체 풀(B)에서. A가 모자라면 B가 메운다.
   * B에도 관심사 단어가 섞여 있으므로 text를 키로 중복을 막는다.
   */
  private mix(interestPool: WordEntity[], pool: WordEntity[], limit: number): WordEntity[] {
    const chosen = new Map<string, WordEntity>();
    const fromInterest = Math.round(limit * INTEREST_RATIO);
    for (const word of shuffle(interestPool).slice(0, fromInterest)) {
      chosen.set(word.text, word);
    }
    for (const word of shuffle(pool)) {
      if (chosen.size >= limit) break;
      chosen.set(word.text, word);
    }
    return [...chosen.values()];
  }
}

/** Fisher-Yates 셔플. 원본을 건드리지 않고 섞은 복사본을 돌려준다. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
