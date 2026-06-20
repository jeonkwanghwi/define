/**
 * UpdateProfileDto — 프로필 완성 입력. 가입과 분리된 PATCH /auth/profile 용.
 * birthYear: 출생연도(정수, 1900~현재) · gender: male/female · interests: 12개 중 1개 이상.
 */
import { ArrayNotEmpty, ArrayUnique, IsIn, IsInt, Max, Min } from 'class-validator';

import { INTERESTS } from '../interests';

export class UpdateProfileDto {
  @IsInt({ message: '출생연도가 올바르지 않습니다.' })
  @Min(1900, { message: '출생연도가 올바르지 않습니다.' })
  @Max(2026, { message: '출생연도가 올바르지 않습니다.' }) // 현재 연도. 매년 갱신 또는 추후 동적 계산.
  birthYear: number;

  @IsIn(['male', 'female'], { message: '성별을 선택하세요.' })
  gender: 'male' | 'female';

  @ArrayNotEmpty({ message: '관심사를 1개 이상 선택하세요.' })
  @ArrayUnique()
  @IsIn([...INTERESTS], { each: true, message: '관심사 값이 올바르지 않습니다.' })
  interests: string[];
}
