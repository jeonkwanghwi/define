/**
 * WordService — 비즈니스 로직 계층. controller(HTTP)와 repository(DB) 사이.
 *
 * 지금은 "단어 목록을 가져와 응답 형태(DTO)로 변환"이 전부지만,
 * 앞으로 "오늘 추천 단어 고르기", "이미 정의한 단어 제외" 같은 규칙이 여기 쌓인다.
 *
 * 핵심: wordRepository는 인터페이스(abstract)다. DB 종류를 모른다 → 로직과 DB가 분리됨.
 */
import { Injectable } from '@nestjs/common';

import { WordResponse } from './dto/word.response';
import { WordRepository } from './word.repository';

@Injectable()
export class WordService {
  // NestJS가 module 바인딩을 보고 알맞은 구현체(PrismaWordRepository)를 자동 주입한다.
  constructor(private readonly wordRepository: WordRepository) {}

  /** 추천 단어 전체를 응답 DTO 목록으로. */
  async listWords(): Promise<WordResponse[]> {
    const words = await this.wordRepository.findAll();
    return words.map((word) => new WordResponse({ id: word.id, text: word.text }));
  }
}
