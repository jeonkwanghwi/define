/**
 * ImportJournalDto — 로컬 단어장 업로드 입력. entries 배열을 중첩 검증한다.
 * @ValidateNested + @Type 이 있어야 ValidationPipe가 배열 원소까지 검사함.
 * savedAt은 JSON이라 ISO 문자열로 받고(@IsDateString), service에서 Date로 변환.
 */
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EntryDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  changeNote?: string;

  @IsDateString()
  savedAt: string;
}

export class ImportJournalDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entries: EntryDto[];
}
