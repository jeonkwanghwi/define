/**
 * NeighborsQueryDto — GET /api/village/neighbors 쿼리.
 * 쿼리 문자열은 전부 string이라 @Type(() => Number)로 숫자 변환 후 @IsInt 검사.
 * 미지정이면 기본 30(맵 슬롯 수 정도) — @IsOptional이라야 기본값이 살아남는다.
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class NeighborsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  count: number = 30;
}
