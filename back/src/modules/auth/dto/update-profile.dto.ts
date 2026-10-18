/**
 * UpdateProfileDto — 프로필 완성 입력. 가입과 분리된 PATCH /auth/profile 용.
 * birthYear: 출생연도(정수, 1900~올해−15) · gender: male/female · interests: 12개 중 1개 이상.
 */
import { ArrayNotEmpty, ArrayUnique, IsIn, IsInt, Min, ValidateBy } from 'class-validator';

import { INTERESTS } from '../interests';

/**
 * 만 14세 미만 가입 차단(개인정보보호법 22조의2). 연도만 받으니 생일을 모른다 →
 * 올해 아직 13살일 수 있는 해(올해−14 이후)는 전부 막는다. 앱의 연도 목록과 같은 규칙.
 *
 * @Max(숫자)로 쓰지 않는 이유: 데코레이터 인자는 **서버가 켜질 때 한 번** 계산된다.
 * 해를 넘겨 계속 떠 있는 서버는 작년 기준으로 검사하게 된다 → 요청마다 올해를 다시 구한다.
 */
const MIN_AGE_GAP = 15;

function IsOldEnough() {
  return ValidateBy({
    name: 'isOldEnough',
    validator: {
      validate: (v: unknown) => typeof v === 'number' && new Date().getFullYear() - v >= MIN_AGE_GAP,
      defaultMessage: () => '만 14세 이상부터 가입할 수 있습니다.',
    },
  });
}

export class UpdateProfileDto {
  @IsInt({ message: '출생연도가 올바르지 않습니다.' })
  @Min(1900, { message: '출생연도가 올바르지 않습니다.' })
  @IsOldEnough()
  birthYear: number;

  @IsIn(['male', 'female'], { message: '성별을 선택하세요.' })
  gender: 'male' | 'female';

  @ArrayNotEmpty({ message: '관심사를 1개 이상 선택하세요.' })
  @ArrayUnique()
  @IsIn([...INTERESTS], { each: true, message: '관심사 값이 올바르지 않습니다.' })
  interests: string[];
}
