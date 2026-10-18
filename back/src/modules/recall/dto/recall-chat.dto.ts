import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** 필터 — 나이(age) 또는 기간(periodStart~End) 중 하나. 둘 다 없으면 전체. */
export class RecallFilterDto {
  @IsOptional() @IsInt() @Min(0) age?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) periodStart?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) periodEnd?: string;
}

export class RecallMessageDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  /**
   * 이 대화 이력은 앱이 매 턴 통째로 다시 보낸다 = 그대로 OpenAI 입력 토큰(비용)이 된다.
   * 2000자: 답변 상한(500토큰)으로 나오는 과거의 나 답장도 넉넉히 들어가는 길이.
   */
  @IsString() @MaxLength(2000) content: string;
}

export class RecallChatDto {
  @ValidateNested() @Type(() => RecallFilterDto) filter: RecallFilterDto;
  /** 40개 = 20왕복. 서비스의 MAX_TURNS_PER_CONVERSATION(20)과 짝이다 — 그보다 긴 이력은 받지 않는다. */
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => RecallMessageDto)
  messages: RecallMessageDto[];
  /** 이어하기 대화 토큰(서버 발급). 없음/무효/만료 → 새 대화로 취급(30잉크 차감). */
  @IsOptional() @IsString() conversationToken?: string;
  /** v1: 'free'(사용자 먼저) | 'question'(과거의 내가 먼저 질문). */
  @IsOptional() @IsIn(['free', 'question']) mode?: 'free' | 'question';
  /** 질문모드: 이 단어를 콕 집어 묻게 함. */
  @IsOptional() @IsString() @MaxLength(30) focusWord?: string;
}
