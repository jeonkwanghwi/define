/**
 * ImportJournalDto — 로컬 단어장 업로드 입력. entries 배열을 중첩 검증한다.
 * @ValidateNested + @Type 이 있어야 ValidationPipe가 배열 원소까지 검사함.
 * savedAt은 JSON이라 ISO 문자열로 받고(@IsDateString), service에서 Date로 변환.
 *
 * 길이 상한이 있는 이유: 광장에 그대로 노출되는 값이라 5000자짜리 "단어"가 모두의 화면을 덮을 수 있었다.
 * ⚠️ 항목 하나만 넘쳐도 배치 전체가 400이다(이미 폰에 있는 옛 기록도 마찬가지).
 *   그래서 상한은 앱이 만들 수 있는 값보다 넉넉하게 잡는다(단어 12자·변화 메모 80자, 정의는 앱에 상한 없음).
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Postgres text는 NUL(\u0000)을 못 담는다 — 그대로 두면 DB 오류(500)가 난다. 입구에서 400으로. */
export const NO_NUL = /^[^\u0000]*$/;

export class EntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(NO_NUL)
  word: string;

  @IsString()
  @MaxLength(5000)
  @Matches(NO_NUL)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(NO_NUL)
  changeNote?: string;

  @IsDateString()
  savedAt: string;
}

export class ImportJournalDto {
  @IsArray()
  @ArrayMinSize(1)
  // 한 요청이 DB에 쓰는 양의 상한. 앱은 바뀐 것만 200개 이하로 나눠 보낸다 — 그보다 넉넉하게.
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entries: EntryDto[];
}
