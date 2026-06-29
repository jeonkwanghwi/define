import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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
  @IsString() content: string;
}

export class RecallChatDto {
  @ValidateNested() @Type(() => RecallFilterDto) filter: RecallFilterDto;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RecallMessageDto)
  messages: RecallMessageDto[];
  @IsBoolean() isNewConversation: boolean;
  /** v1은 'free'만 허용. 후속에서 enum 확장. */
  @IsOptional() @IsIn(['free']) mode?: 'free';
}
