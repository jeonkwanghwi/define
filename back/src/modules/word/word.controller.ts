/**
 * WordController — HTTP 계층. URL과 메서드를 service 호출에 연결만 한다(얇게).
 *
 * @Controller('words') + 전역 프리픽스 'api' → 이 컨트롤러의 기준 경로는 /api/words.
 * @Get() → GET 요청을 findAll()에 매핑.
 *
 * 로직은 일절 두지 않는다(검증은 dto, 규칙은 service). 컨트롤러는 "교통정리"만.
 */
import { Controller, Get } from '@nestjs/common';

import { WordResponse } from './dto/word.response';
import { WordService } from './word.service';

@Controller('words')
export class WordController {
  constructor(private readonly wordService: WordService) {}

  /** GET /api/words — 추천 단어 목록. */
  @Get()
  findAll(): Promise<WordResponse[]> {
    return this.wordService.listWords();
  }
}
